# v0.2.16
import pytest
from genlayer_py import *

def test_claim_verdict_single_contract_flow(direct_vm, direct_deploy, direct_accounts):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]

    # Deploy single consolidated contract
    court = direct_deploy("contracts/claim_verdict.py")

    # Give operator some native balance
    direct_vm._balances[operator] = 100000
    initial_court_balance = direct_vm._balances.get(court.address, 0)

    # 1. Create Policy Pool
    direct_vm.sender = operator
    pool_id = court.create_policy_pool(
        "Flight Cancellation",
        ["Flight cancelled by airline", "No refund received"],
        1000
    )

    # 2. Deposit Native GEN Escrow to Pool
    deposit_amount = 5000
    direct_vm.sender = operator
    direct_vm.value = deposit_amount
    direct_vm._balances[court.address] = direct_vm._balances.get(court.address, 0) + deposit_amount
    court.deposit_to_pool(pool_id)
    direct_vm.value = 0

    # Assert contract's REAL native balance increased by deposit_amount
    new_court_balance = direct_vm._balances.get(court.address, 0)
    assert new_court_balance == initial_court_balance + deposit_amount
    assert court.get_pool_balance(pool_id) == str(deposit_amount)

    # 3. Submit Claim (with 2 independent reference verification URLs)
    evidence_urls = ["https://example.com/cancellation-email.html"]
    reference_urls = [
        "https://flightstats.example.com/status/123",
        "https://weather.example.com/report/123"
    ]

    direct_vm.sender = claimant
    claim_id = court.submit_claim(
        pool_id,
        800,
        "Flight cancelled due to extreme storm",
        evidence_urls,
        reference_urls
    )

    claim = court.get_claim(claim_id)
    assert claim["status"] == "SUBMITTED"
    assert claim["claimant"].lower() == ("0x" + claimant.hex()).lower()

    # 4. Mock Non-deterministic Web Renders & LLM Consensus
    direct_vm.mock_web("https://example.com/cancellation-email.html", "Flight VN123 Cancelled due to storm")
    direct_vm.mock_web("https://flightstats.example.com/status/123", "Flight VN123 status: CANCELLED")
    direct_vm.mock_web("https://weather.example.com/report/123", "Severe Weather Warning Issued")

    direct_vm.mock_llm(
        ".*",
        '{"compliance_pct": 100, "confidence": 95, "reason": "All criteria met based on flight status and weather report"}'
    )

    # 5. Resolve Claim
    direct_vm.sender = operator
    court.resolve_claim(claim_id)

    resolved_claim = court.get_claim(claim_id)
    print("DEBUG resolved_claim:", resolved_claim)
    assert resolved_claim["status"] == "RESOLVED"
    assert resolved_claim["compliance_pct"] == 100
    assert resolved_claim["payout_amount"] == "800"
    assert resolved_claim["paid_out"] == True

    # Verify Pool Balance Deducted
    assert court.get_pool_balance(pool_id) == str(deposit_amount - 800)

    # Verify Reputation Stats
    rep = court.get_claimant_reputation(claimant)
    assert rep["total_claims"] == 1
    assert rep["avg_compliance_pct"] == 100


def test_claim_validation_errors(direct_vm, direct_deploy, direct_accounts):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]

    court = direct_deploy("contracts/claim_verdict.py")

    direct_vm.sender = operator
    pool_id = court.create_policy_pool(
        "Sports Injury",
        ["Accidental injury", "Hospital bill provided"],
        2000
    )

    # Less than 2 reference URLs -> error
    direct_vm.sender = claimant
    with pytest.raises(Exception):
        court.submit_claim(
            pool_id,
            500,
            "Broken leg during match",
            ["https://example.com/bill.html"],
            ["https://example.com/ref1.html"]
        )

    # Claimed amount <= 0 -> error
    with pytest.raises(Exception):
        court.submit_claim(
            pool_id,
            0,
            "Broken leg",
            ["https://example.com/bill.html"],
            ["https://example.com/ref1.html", "https://example.com/ref2.html"]
        )


def test_low_confidence_disputed_flow(direct_vm, direct_deploy, direct_accounts):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]

    court = direct_deploy("contracts/claim_verdict.py")

    direct_vm.sender = operator
    pool_id = court.create_policy_pool("Medical", ["Emergency hospitalization"], 5000)

    direct_vm.value = 10000
    court.deposit_to_pool(pool_id)
    direct_vm.value = 0

    direct_vm.sender = claimant
    claim_id = court.submit_claim(
        pool_id,
        1500,
        "Unclear medical treatment",
        ["https://example.com/receipt.html"],
        ["https://example.com/hospital.html", "https://example.com/doctor.html"]
    )

    direct_vm.mock_web("https://example.com/receipt.html", "Receipt blurry")
    direct_vm.mock_web("https://example.com/hospital.html", "Record pending")
    direct_vm.mock_web("https://example.com/doctor.html", "Note missing")

    # Low confidence (<60)
    direct_vm.mock_llm(
        ".*",
        '{"compliance_pct": 70, "confidence": 45, "reason": "Receipt blurry and records incomplete"}'
    )

    direct_vm.sender = operator
    court.resolve_claim(claim_id)

    disputed_claim = court.get_claim(claim_id)
    assert disputed_claim["status"] == "DISPUTED"
    assert disputed_claim["confidence"] == 45
    assert disputed_claim["paid_out"] == False

    # Claimant submits additional evidence
    direct_vm.sender = claimant
    court.add_evidence(
        claim_id,
        ["https://example.com/clear_receipt.html"],
        ["https://example.com/official_record.html"]
    )

    updated_claim = court.get_claim(claim_id)
    assert updated_claim["status"] == "SUBMITTED"


def test_insufficient_pool_funds(direct_vm, direct_deploy, direct_accounts):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]

    court = direct_deploy("contracts/claim_verdict.py")

    direct_vm.sender = operator
    pool_id = court.create_policy_pool("Travel", ["Cancellation"], 1000)
    # Zero balance in pool

    direct_vm.sender = claimant
    claim_id = court.submit_claim(
        pool_id,
        500,
        "Trip cancelled",
        ["https://example.com/proof.html"],
        ["https://example.com/ref1.html", "https://example.com/ref2.html"]
    )

    claim = court.get_claim(claim_id)
    assert claim["status"] == "REJECTED_NO_FUNDS"


def test_escrow_reservation_insufficient_funds_on_resolve(direct_vm, direct_deploy, direct_accounts):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]

    court = direct_deploy("contracts/claim_verdict.py")

    direct_vm.sender = operator
    pool_id = court.create_policy_pool("Flight", ["Flight Cancelled"], 5000)

    # Deposit 500 wei (less than 1000 claimed)
    direct_vm.value = 500
    court.deposit_to_pool(pool_id)
    direct_vm.value = 0

    direct_vm.sender = claimant
    # Initially pool has 500, but claim submits 100
    claim_id = court.submit_claim(
        pool_id,
        100,
        "Flight cancelled",
        ["https://example.com/e.html"],
        ["https://example.com/r1.html", "https://example.com/r2.html"]
    )
    assert court.get_claim(claim_id)["status"] == "SUBMITTED"

    # Manually drain pool balance or test insufficient escrow on resolve
    # Drain balance to 0
    court.pool_balances[pool_id] = 0
    pool = court.pools[pool_id]
    pool.pool_balance = 0
    court.pools[pool_id] = pool

    direct_vm.mock_web("https://example.com/e.html", "Cancelled")
    direct_vm.mock_web("https://example.com/r1.html", "Confirmed Cancelled")
    direct_vm.mock_web("https://example.com/r2.html", "Confirmed Cancelled")
    direct_vm.mock_llm(".*", '{"compliance_pct": 100, "confidence": 90, "reason": "Valid claim"}')

    direct_vm.sender = operator
    court.resolve_claim(claim_id)

    res_claim = court.get_claim(claim_id)
    # Escrow insufficient on resolve -> status becomes REJECTED_NO_FUNDS, NOT RESOLVED
    assert res_claim["status"] == "REJECTED_NO_FUNDS"
    assert res_claim["paid_out"] == False


def test_base_units_wei_roundtrip(direct_vm, direct_deploy, direct_accounts):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]

    court = direct_deploy("contracts/claim_verdict.py")

    # 10 GEN in base units (wei = 10 * 10^18)
    ten_gen_wei = 10 * 10**18
    five_gen_wei = 5 * 10**18

    direct_vm.sender = operator
    pool_id = court.create_policy_pool("Auto", ["Collision report"], ten_gen_wei)

    direct_vm.value = ten_gen_wei
    direct_vm._balances[court.address] = direct_vm._balances.get(court.address, 0) + ten_gen_wei
    court.deposit_to_pool(pool_id)
    direct_vm.value = 0

    assert court.get_pool_balance(pool_id) == str(ten_gen_wei)

    direct_vm.sender = claimant
    claim_id = court.submit_claim(
        pool_id,
        five_gen_wei,
        "Rear-ended at traffic signal",
        ["https://example.com/damage.html"],
        ["https://example.com/police.html", "https://example.com/repair.html"]
    )

    direct_vm.mock_web("https://example.com/damage.html", "Rear bumper damaged")
    direct_vm.mock_web("https://example.com/police.html", "Accident report #402")
    direct_vm.mock_web("https://example.com/repair.html", "Estimate 5 GEN")
    direct_vm.mock_llm(".*", '{"compliance_pct": 100, "confidence": 95, "reason": "Full match"}')

    direct_vm.sender = operator
    court.resolve_claim(claim_id)

    res_claim = court.get_claim(claim_id)
    assert res_claim["status"] == "RESOLVED"
    assert res_claim["payout_amount"] == str(five_gen_wei)
    assert court.get_pool_balance(pool_id) == str(five_gen_wei)


def test_retry_resolution_after_funding(direct_vm, direct_deploy, direct_accounts):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]

    court = direct_deploy("contracts/claim_verdict.py")

    direct_vm.sender = operator
    pool_id = court.create_policy_pool("Health", ["Hospitalization"], 5000)

    # Initial zero balance -> submit claim
    direct_vm.sender = claimant
    claim_id = court.submit_claim(
        pool_id,
        1000,
        "ER visit for fracture",
        ["https://example.com/er.html"],
        ["https://example.com/hosp1.html", "https://example.com/hosp2.html"]
    )

    # Claim rejected due to zero funds
    assert court.get_claim(claim_id)["status"] == "REJECTED_NO_FUNDS"

    # Now operator deposits funds to pool
    direct_vm.sender = operator
    direct_vm.value = 5000
    direct_vm._balances[court.address] = direct_vm._balances.get(court.address, 0) + 5000
    court.deposit_to_pool(pool_id)
    direct_vm.value = 0

    direct_vm.mock_web("https://example.com/er.html", "ER discharge summary")
    direct_vm.mock_web("https://example.com/hosp1.html", "Patient record confirmed")
    direct_vm.mock_web("https://example.com/hosp2.html", "Billing confirmed 1000")
    direct_vm.mock_llm(".*", '{"compliance_pct": 100, "confidence": 90, "reason": "ER visit verified"}')

    # Claimant calls retry_resolution -> status transitions to RESOLVED and pays out!
    direct_vm.sender = claimant
    court.retry_resolution(claim_id)

    res_claim = court.get_claim(claim_id)
    assert res_claim["status"] == "RESOLVED"
    assert res_claim["payout_amount"] == "1000"
    assert res_claim["paid_out"] == True
    assert court.get_pool_balance(pool_id) == str(5000 - 1000)


def test_transfer_failure_rollback(direct_vm, direct_deploy, direct_accounts, monkeypatch):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]

    court = direct_deploy("contracts/claim_verdict.py")

    direct_vm.sender = operator
    pool_id = court.create_policy_pool("Flight", ["Cancellation"], 5000)

    # Fund internal pool balance to 3000 wei
    court.pool_balances[pool_id] = 3000
    pool = court.pools[pool_id]
    pool.pool_balance = 3000
    court.pools[pool_id] = pool

    import gltest.direct.loader
    def failing_emit_transfer(self, value):
        raise Exception("Simulated native transfer execution failure")

    monkeypatch.setattr(gltest.direct.loader._EOAProxy, "emit_transfer", failing_emit_transfer)

    direct_vm.sender = claimant
    claim_id = court.submit_claim(
        pool_id,
        1000,
        "Storm cancellation",
        ["https://example.com/proof.html"],
        ["https://example.com/ref1.html", "https://example.com/ref2.html"]
    )

    direct_vm.mock_web("https://example.com/proof.html", "Flight cancelled")
    direct_vm.mock_web("https://example.com/ref1.html", "Confirmed")
    direct_vm.mock_web("https://example.com/ref2.html", "Confirmed")
    direct_vm.mock_llm(".*", '{"compliance_pct": 100, "confidence": 95, "reason": "Approved"}')

    direct_vm.sender = operator
    court.resolve_claim(claim_id)

    res_claim = court.get_claim(claim_id)
    # Transfer failed due to mocked exception -> status is PAYOUT_FAILED, paid_out is False, pool_balance rolled back to 3000!
    assert res_claim["status"] == "PAYOUT_FAILED"
    assert res_claim["paid_out"] == False
    assert court.get_pool_balance(pool_id) == "3000"

