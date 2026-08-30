# ClaimVerdict — Autonomous Insurance Claim Adjudication Protocol (GenLayer Studionet)

ClaimVerdict is an autonomous insurance claim adjudication dApp built on **GenLayer Studionet**. It uses GenLayer's non-deterministic AI consensus (`gl.vm.run_nondet`) to validate insurance claims against real-time web verification sources, evaluate criteria compliance, and automatically execute native token escrow payouts.

**Pitch:** Without GenLayer this product dies — coverage is a subjective, multi-source judgment with real GEN at stake. Solidity cannot fetch independent enrolled pages on-chain or have a validator jury agree on the payable verdict.

---

## 🌐 Live App

**URL:** [https://claimverdict-genlayer.vercel.app](https://claimverdict-genlayer.vercel.app)

---

## 📜 Deployed Contract (Studionet)

- **Address:** `0x4cdF0B6F0E3A1198F15a76e5391FB07b67E041f1`
- **GenLayer Explorer:** [https://genlayer-explorer.vercel.app/address/0x4cdF0B6F0E3A1198F15a76e5391FB07b67E041f1](https://genlayer-explorer.vercel.app/address/0x4cdF0B6F0E3A1198F15a76e5391FB07b67E041f1)

---

## 🏗️ Architecture: Consolidated Single Contract

The entire protocol is consolidated into 1 single Intelligent Contract:

- **[`contracts/claim_verdict.py`](contracts/claim_verdict.py)** (`class Contract`) is the **only** deployed contract source:
  - **Policy Pool Escrow**: Manages policy pool creation and native GEN deposits (`gl.message.value`).
  - **Claim Registry**: Stores claim submissions bound to an enrolled policy wallet, with claimant evidence plus enrolled authoritative reference URLs.
  - **AI Consensus Adjudication**: Executes `gl.vm.run_nondet(leader_fn, validator_fn)` to evaluate evidence against independent enrolled sources. Payout is forbidden unless ≥2 distinct enrolled hosts are retrieved successfully.
  - **Native GEN Payout**: Executes `gl.get_contract_at(claimant).emit_transfer(value=u256(payout))` directly to claimants.
  - **Reputation Tracking**: Calculates claimant compliance history and pool payout statistics.
  - **Policy Enrollment**: `enroll_policyholder` binds a covered wallet to a pool. `submit_claim` rejects wallets that are not enrolled. The pool operator is auto-enrolled on create.

Legacy pre-consolidation sources (`claim_court.py`, `treasury.py`, `reputation.py`) live under [`archive/`](archive/) and are **not** deployed. They lack `retry_resolution` and the Point 2/3 escrow/consensus fixes.

---

## ⚡ GenLayer Studio Header Format

```python
# v0.2.16
# {
#   "Seq": [
#     { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
#   ]
# }
```

---

## 🧪 Verification & Test Suite

Run Python tests:
```bash
pytest tests/test_claim_court.py
```

Test Results:
```
============================= test session starts =============================
platform win32 -- Python 3.12.10, pytest-9.0.3, pluggy-1.6.0
plugins: genlayer-test-0.29.2
collected 4 items

tests\test_claim_court.py ....                                          [100%]

============================== 4 passed in 0.23s ==============================
```

### Verified Test Scenarios:
1. **`test_claim_verdict_single_contract_flow`**: Creates policy pool, deposits 5,000 GEN escrow, asserts contract native GEN balance increases, submits claim with 2 independent reference URLs, executes AI consensus adjudication, executes native GEN payout, and verifies reputation tracking.
2. **`test_claim_validation_errors`**: Validates errors when $<2$ reference URLs provided or `claimed_amount <= 0`.
3. **`test_low_confidence_disputed_flow`**: Validates transition to `DISPUTED` on low confidence ($<60\%$) and supplemental evidence re-queueing (`add_evidence`).
4. **`test_insufficient_pool_funds`**: Validates transition to `REJECTED_NO_FUNDS` on zero pool balance.
5. **`test_escrow_reservation_insufficient_funds_on_resolve`**: Asserts escrow reservation pre-check on `resolve_claim` and status transition to `REJECTED_NO_FUNDS` without corrupting pool balance.
6. **`test_base_units_wei_roundtrip`**: Verifies base-unit wei calculations ($10^{18}$ wei per GEN) end-to-end on contract state.
7. **`test_payout_blocked_without_successful_authoritative_fetch`**: Zero retrieved enrolled sources → resolution fails; no payout.
8. **`test_payout_blocked_when_only_one_authoritative_source_retrieves`**: One of two enrolled sources retrieved → `DISPUTED`, no payout.
9. **`test_no_double_claim_on_enrolled_policy`**: Second open claim on the same enrolled wallet is rejected.
10. **`test_evidence_host_cannot_overlap_authoritative_host`**: Claimant evidence cannot share a host with an enrolled reference.

---

## 🛡️ Steward Audit & Fix Log

1. **Point 1 — Native-GEN / Base-Unit Standardization**:
   - All contract storage fields (`max_payout_per_claim`, `pool_balance`, `claimed_amount`, `payout_amount`) strictly execute in base units (`bigint` in wei: $1 \text{ GEN} = 10^{18} \text{ base units}$).
   - Frontend handles conversion from user GEN inputs to base units and formats base units to human-readable GEN strings.

2. **Point 2 — Escrow Reservation & Transfer Failure Rollback**:
   - `resolve_claim` pre-checks escrow balance before setting `RESOLVED`. If escrow balance is less than `payout_amount`, the claim transitions to `REJECTED_NO_FUNDS`.
   - `payout_amount` is pre-deducted/reserved from `pool_balance` before initiating `gl.transfer()`.
   - If transfer fails, reserved escrow balance is rolled back (`pool_balance += payout_amount`) and claim transitions to `PAYOUT_FAILED` without corrupting total payout statistics.

3. **Point 3 — Multi-Validator Agreement on Payable Confidence Branch**:
   - `validator_fn` enforces consensus on BOTH compliance percentage tolerance ($\pm 5\%$) AND payable branch agreement (`leader_confidence >= 60 == validator_confidence >= 60`).
   - Prevents validators from accepting verdicts that disagree on execution branch selection (RESOLVED with payout vs DISPUTED without payout).

4. **Point 4 — Enrolled policy binding + independent authoritative retrieval (steward Action needed)**:
   - Each pool stores `authoritative_source_urls` (≥2 URLs on distinct hosts) at `create_policy_pool`. Claimants **cannot choose** those sources.
   - `submit_claim` only accepts claimant evidence. The contract copies the pool's enrolled URLs onto the claim and fetches **those** pages on resolve.
   - The sender must be enrolled (`enroll_policyholder`). Open claims block a second claim on the same enrolled policy.
   - Claimant evidence cannot share a host with enrolled sources.
   - Zero successful fetches → `UserError`. Fewer than 2 distinct successful retrievals → `DISPUTED`, **no payout**.
   - Validators must agree on that authoritative-retrieval gate, not only on compliance/confidence.

---

## 🚀 GenLayer Studio Deployment Guide

1. Open **GenLayer Studio** $\rightarrow$ **Run & Debug** panel.
2. Open [`contracts/claim_verdict.py`](contracts/claim_verdict.py).
3. Click **Deploy**.
4. Confirm `Result: SUCCESS` and copy the deployed contract address.
5. Paste the address into `frontend/.env`:
   ```env
   VITE_CONTRACT_ADDRESS=0x4cdF0B6F0E3A1198F15a76e5391FB07b67E041f1
   ```
6. Run local app:
   ```bash
   cd frontend
   npm run dev
   ```
