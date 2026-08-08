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
