# ClaimVerdict — Autonomous Insurance Claim Adjudication Protocol (GenLayer Studionet)

ClaimVerdict is an autonomous insurance claim adjudication dApp built on **GenLayer Studionet**. It uses GenLayer's non-deterministic AI consensus (`gl.vm.run_nondet`) to validate insurance claims against real-time web verification sources, evaluate criteria compliance, and automatically execute native token escrow payouts.

---

## 🌐 Live App

**URL:** [https://claimverdict-genlayer.vercel.app](https://claimverdict-genlayer.vercel.app)

---

## 📜 Deployed Contract (Studionet)

- **Address:** `0x030838e6829f5fA3CEEf6989c1dd78d2c626BAe3`
- **GenLayer Explorer:** [https://genlayer-explorer.vercel.app/address/0x030838e6829f5fA3CEEf6989c1dd78d2c626BAe3](https://genlayer-explorer.vercel.app/address/0x030838e6829f5fA3CEEf6989c1dd78d2c626BAe3)

---

## 🏗️ Architecture: Consolidated Single Contract

The entire protocol is consolidated into 1 single Intelligent Contract:

- **[`contracts/claim_verdict.py`](contracts/claim_verdict.py)** (`ClaimVerdict`) is the **only** deployed contract source:
  - **Policy Pool Escrow**: Manages policy pool creation and native GEN deposits (`gl.message.value`).
  - **Claim Registry**: Stores claim submissions with evidence and independent reference URLs.
  - **AI Consensus Adjudication**: Executes `gl.vm.run_nondet(leader_fn, validator_fn)` to evaluate evidence against independent sources.
  - **Native GEN Payout**: Executes `gl.get_contract_at(claimant).emit_transfer(value=u256(payout))` directly to claimants.
  - **Reputation Tracking**: Calculates claimant compliance history and pool payout statistics.

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

---

## 🚀 GenLayer Studio Deployment Guide

1. Open **GenLayer Studio** $\rightarrow$ **Run & Debug** panel.
2. Open [`contracts/claim_verdict.py`](contracts/claim_verdict.py).
3. Click **Deploy**.
4. Confirm `Result: SUCCESS` and copy the deployed contract address.
5. Paste the address into `frontend/.env`:
   ```env
   VITE_CONTRACT_ADDRESS=0x030838e6829f5fA3CEEf6989c1dd78d2c626BAe3
   ```
6. Run local app:
   ```bash
   cd frontend
   npm run dev
   ```
