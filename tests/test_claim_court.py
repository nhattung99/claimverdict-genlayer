# v0.2.16
import pytest
from genlayer_py import *

AUTH_URLS = [
    "https://flightstats.com/status/123",
    "https://weather.gov/report/123",
]
EVIDENCE = ["https://receipts.claimant-cdn.net/doc.html"]


def _fund_pool(court, vm, operator, claimant, coverage, criteria, cap, deposit=0):
    vm.sender = operator
    pool_id = court.create_policy_pool(coverage, criteria, AUTH_URLS, cap)
    court.enroll_policyholder(pool_id, claimant)
    if deposit > 0:
        vm.value = deposit
        vm._balances[court.address] = vm._balances.get(court.address, 0) + deposit
        court.deposit_to_pool(pool_id)
        vm.value = 0
    return pool_id


def _mock_standard_web(vm):
    vm.mock_web("https://receipts.claimant-cdn.net/doc.html", "Claimant receipt and incident confirmation document")
    vm.mock_web("https://flightstats.com/status/123", "Official status: CANCELLED by carrier")
    vm.mock_web("https://weather.gov/report/123", "Severe weather warning issued for the route")


def test_claim_verdict_single_contract_flow(direct_vm, direct_deploy, direct_accounts):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]
    court = direct_deploy("contracts/claim_verdict.py")
    direct_vm._balances[operator] = 100000
    initial_court_balance = direct_vm._balances.get(court.address, 0)

    deposit_amount = 5000
    pool_id = _fund_pool(
        court, direct_vm, operator, claimant,
        "Flight Cancellation",
        ["Flight cancelled by airline", "No refund received"],
        1000,
        deposit_amount,
    )

    new_court_balance = direct_vm._balances.get(court.address, 0)
    assert new_court_balance == initial_court_balance + deposit_amount
    assert court.get_pool_balance(pool_id) == str(deposit_amount)
    assert court.is_enrolled(pool_id, claimant) is True
    pool = court.get_pool(pool_id)
    assert pool["authoritative_source_urls"] == AUTH_URLS
    assert "flightstats.com" in pool["allowed_source_hosts"]
    assert "weather.gov" in pool["allowed_source_hosts"]

    direct_vm.sender = claimant
    claim_id = court.submit_claim(
        pool_id, 800, "Flight cancelled due to extreme storm", EVIDENCE
    )
    claim = court.get_claim(claim_id)
    assert claim["status"] == "SUBMITTED"
    assert claim["claimant"].lower() == ("0x" + claimant.hex()).lower()
    assert claim["reference_urls"] == AUTH_URLS

    _mock_standard_web(direct_vm)
    direct_vm.mock_llm(
        ".*",
        '{"compliance_pct": 100, "confidence": 95, "reason": "All criteria met", "authoritative_ok": true, "retrieved_count": 2}',
    )
    direct_vm.sender = operator
    court.resolve_claim(claim_id)

    resolved_claim = court.get_claim(claim_id)
    assert resolved_claim["status"] == "RESOLVED"
    assert resolved_claim["compliance_pct"] == 100
    assert resolved_claim["payout_amount"] == "800"
    assert resolved_claim["paid_out"] is True
    assert resolved_claim["authoritative_retrieved"] == 2
    assert court.get_pool_balance(pool_id) == str(deposit_amount - 800)
    rep = court.get_claimant_reputation(claimant)
    assert rep["total_claims"] == 1
    assert rep["avg_compliance_pct"] == 100


def test_claim_validation_errors(direct_vm, direct_deploy, direct_accounts):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]
    outsider = direct_accounts[3]
    court = direct_deploy("contracts/claim_verdict.py")
    pool_id = _fund_pool(
        court, direct_vm, operator, claimant,
        "Sports Injury",
        ["Accidental injury", "Hospital bill provided"],
        2000,
    )

    direct_vm.sender = claimant
    with pytest.raises(Exception):
        court.submit_claim(pool_id, 0, "Broken leg", EVIDENCE)

    with pytest.raises(Exception):
        court.submit_claim(pool_id, 500, "Broken leg", [])

    with pytest.raises(Exception):
        court.submit_claim(pool_id, 500, "Overlapping source", ["https://flightstats.com/my-ticket"])

    direct_vm.sender = outsider
    with pytest.raises(Exception):
        court.submit_claim(pool_id, 500, "Not enrolled", EVIDENCE)

    direct_vm.sender = operator
    with pytest.raises(Exception):
        court.create_policy_pool(
            "Bad",
            ["One criterion"],
            ["https://flightstats.com/a", "https://status.flightstats.com/b"],
            1000,
        )


def test_low_confidence_disputed_flow(direct_vm, direct_deploy, direct_accounts):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]
    court = direct_deploy("contracts/claim_verdict.py")
    pool_id = _fund_pool(
        court, direct_vm, operator, claimant, "Medical", ["Emergency hospitalization"], 5000, 10000
    )

    direct_vm.sender = claimant
    claim_id = court.submit_claim(pool_id, 1500, "Unclear medical treatment", EVIDENCE)

    _mock_standard_web(direct_vm)
    direct_vm.mock_llm(
        ".*",
        '{"compliance_pct": 70, "confidence": 45, "reason": "Records incomplete", "authoritative_ok": true, "retrieved_count": 2}',
    )
    direct_vm.sender = operator
    court.resolve_claim(claim_id)
    disputed_claim = court.get_claim(claim_id)
    assert disputed_claim["status"] == "DISPUTED"
    assert disputed_claim["confidence"] == 45
    assert disputed_claim["paid_out"] is False

    direct_vm.sender = claimant
    court.add_evidence(claim_id, ["https://archive.claimant-cdn.net/clear.html"])
    updated_claim = court.get_claim(claim_id)
    assert updated_claim["status"] == "SUBMITTED"
    assert updated_claim["reference_urls"] == AUTH_URLS


def test_insufficient_pool_funds(direct_vm, direct_deploy, direct_accounts):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]
    court = direct_deploy("contracts/claim_verdict.py")
    pool_id = _fund_pool(court, direct_vm, operator, claimant, "Travel", ["Cancellation"], 1000, 0)
    direct_vm.sender = claimant
    claim_id = court.submit_claim(pool_id, 500, "Trip cancelled", EVIDENCE)
    assert court.get_claim(claim_id)["status"] == "REJECTED_NO_FUNDS"


def test_escrow_reservation_insufficient_funds_on_resolve(direct_vm, direct_deploy, direct_accounts):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]
    court = direct_deploy("contracts/claim_verdict.py")
    pool_id = _fund_pool(court, direct_vm, operator, claimant, "Flight", ["Flight Cancelled"], 5000, 500)

    direct_vm.sender = claimant
    claim_id = court.submit_claim(pool_id, 100, "Flight cancelled", EVIDENCE)
    assert court.get_claim(claim_id)["status"] == "SUBMITTED"

    court.pool_balances[pool_id] = 0
    pool = court.pools[pool_id]
    pool.pool_balance = 0
    court.pools[pool_id] = pool

    _mock_standard_web(direct_vm)
    direct_vm.mock_llm(".*", '{"compliance_pct": 100, "confidence": 90, "reason": "Valid claim", "authoritative_ok": true, "retrieved_count": 2}')
    direct_vm.sender = operator
    court.resolve_claim(claim_id)
    res_claim = court.get_claim(claim_id)
    assert res_claim["status"] == "REJECTED_NO_FUNDS"
    assert res_claim["paid_out"] is False


def test_base_units_wei_roundtrip(direct_vm, direct_deploy, direct_accounts):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]
    court = direct_deploy("contracts/claim_verdict.py")
    ten_gen_wei = 10 * 10**18
    five_gen_wei = 5 * 10**18
    pool_id = _fund_pool(court, direct_vm, operator, claimant, "Auto", ["Collision report"], ten_gen_wei, ten_gen_wei)
    assert court.get_pool_balance(pool_id) == str(ten_gen_wei)

    direct_vm.sender = claimant
    claim_id = court.submit_claim(pool_id, five_gen_wei, "Rear-ended at traffic signal", EVIDENCE)
    _mock_standard_web(direct_vm)
    direct_vm.mock_llm(".*", '{"compliance_pct": 100, "confidence": 95, "reason": "Full match", "authoritative_ok": true, "retrieved_count": 2}')
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
    pool_id = _fund_pool(court, direct_vm, operator, claimant, "Health", ["Hospitalization"], 5000, 0)

    direct_vm.sender = claimant
    claim_id = court.submit_claim(pool_id, 1000, "ER visit for fracture", EVIDENCE)
    assert court.get_claim(claim_id)["status"] == "REJECTED_NO_FUNDS"

    direct_vm.sender = operator
    direct_vm.value = 5000
    direct_vm._balances[court.address] = direct_vm._balances.get(court.address, 0) + 5000
    court.deposit_to_pool(pool_id)
    direct_vm.value = 0

    _mock_standard_web(direct_vm)
    direct_vm.mock_llm(".*", '{"compliance_pct": 100, "confidence": 90, "reason": "ER visit verified", "authoritative_ok": true, "retrieved_count": 2}')
    direct_vm.sender = claimant
    court.retry_resolution(claim_id)
    res_claim = court.get_claim(claim_id)
    assert res_claim["status"] == "RESOLVED"
    assert res_claim["payout_amount"] == "1000"
    assert res_claim["paid_out"] is True
    assert court.get_pool_balance(pool_id) == str(5000 - 1000)


def test_transfer_failure_rollback(direct_vm, direct_deploy, direct_accounts, monkeypatch):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]
    court = direct_deploy("contracts/claim_verdict.py")
    pool_id = _fund_pool(court, direct_vm, operator, claimant, "Flight", ["Cancellation"], 5000, 0)
    court.pool_balances[pool_id] = 3000
    pool = court.pools[pool_id]
    pool.pool_balance = 3000
    court.pools[pool_id] = pool

    import gltest.direct.loader

    def failing_emit_transfer(self, value):
        raise Exception("Simulated native transfer execution failure")

    monkeypatch.setattr(gltest.direct.loader._EOAProxy, "emit_transfer", failing_emit_transfer)

    direct_vm.sender = claimant
    claim_id = court.submit_claim(pool_id, 1000, "Storm cancellation", EVIDENCE)
    _mock_standard_web(direct_vm)
    direct_vm.mock_llm(".*", '{"compliance_pct": 100, "confidence": 95, "reason": "Approved", "authoritative_ok": true, "retrieved_count": 2}')
    direct_vm.sender = operator
    court.resolve_claim(claim_id)
    res_claim = court.get_claim(claim_id)
    assert res_claim["status"] == "PAYOUT_FAILED"
    assert res_claim["paid_out"] is False
    assert court.get_pool_balance(pool_id) == "3000"


def test_payout_blocked_without_successful_authoritative_fetch(direct_vm, direct_deploy, direct_accounts):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]
    court = direct_deploy("contracts/claim_verdict.py")
    pool_id = _fund_pool(court, direct_vm, operator, claimant, "Flight", ["Cancelled"], 1000, 5000)

    direct_vm.sender = claimant
    claim_id = court.submit_claim(pool_id, 200, "Cancelled flight", EVIDENCE)
    direct_vm.mock_web("https://receipts.claimant-cdn.net/doc.html", "Claimant ticket receipt content here")
    direct_vm.mock_llm(".*", '{"compliance_pct": 100, "confidence": 99, "reason": "Should not pay", "authoritative_ok": true, "retrieved_count": 2}')
    direct_vm.sender = operator
    with pytest.raises(Exception):
        court.resolve_claim(claim_id)
    still = court.get_claim(claim_id)
    assert still["status"] == "SUBMITTED"
    assert still["paid_out"] is False
    assert court.get_pool_balance(pool_id) == "5000"


def test_payout_blocked_when_only_one_authoritative_source_retrieves(direct_vm, direct_deploy, direct_accounts):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]
    court = direct_deploy("contracts/claim_verdict.py")
    pool_id = _fund_pool(court, direct_vm, operator, claimant, "Flight", ["Cancelled"], 1000, 5000)

    direct_vm.sender = claimant
    claim_id = court.submit_claim(pool_id, 200, "Cancelled flight", EVIDENCE)
    direct_vm.mock_web("https://receipts.claimant-cdn.net/doc.html", "Claimant ticket receipt content here")
    direct_vm.mock_web("https://flightstats.com/status/123", "Official status: CANCELLED by carrier")
    direct_vm.mock_llm(
        ".*",
        '{"compliance_pct": 100, "confidence": 99, "reason": "Partial sources", "authoritative_ok": true, "retrieved_count": 2}',
    )
    direct_vm.sender = operator
    court.resolve_claim(claim_id)
    blocked = court.get_claim(claim_id)
    assert blocked["status"] == "DISPUTED"
    assert blocked["paid_out"] is False
    assert blocked["authoritative_retrieved"] == 1
    assert court.get_pool_balance(pool_id) == "5000"


def test_no_double_claim_on_enrolled_policy(direct_vm, direct_deploy, direct_accounts):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]
    court = direct_deploy("contracts/claim_verdict.py")
    pool_id = _fund_pool(court, direct_vm, operator, claimant, "Flight", ["Cancelled"], 1000, 5000)
    direct_vm.sender = claimant
    court.submit_claim(pool_id, 200, "First open claim", EVIDENCE)
    with pytest.raises(Exception):
        court.submit_claim(pool_id, 150, "Second overlapping claim", EVIDENCE)


def test_evidence_host_cannot_overlap_authoritative_host(direct_vm, direct_deploy, direct_accounts):
    operator = direct_accounts[1]
    claimant = direct_accounts[2]
    court = direct_deploy("contracts/claim_verdict.py")
    pool_id = _fund_pool(court, direct_vm, operator, claimant, "Flight", ["Cancelled"], 1000)
    direct_vm.sender = claimant
    with pytest.raises(Exception):
        court.submit_claim(
            pool_id,
            200,
            "Overlapping hosts",
            ["https://weather.gov/my-receipt"],
        )
