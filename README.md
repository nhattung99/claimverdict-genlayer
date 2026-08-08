# ClaimVerdict — Autonomous Insurance Claim Adjudication Protocol (GenLayer Studionet)

ClaimVerdict is an Intelligent Contract protocol on **GenLayer Studionet** that automates insurance claim processing using non-deterministic AI consensus (`gl.vm.run_nondet`). It validates claimant evidence against real-time independent web verification sources, calculates criteria compliance percentage, and executes native GEN escrow payouts automatically.

---

## 🏗️ Architecture: Consolidated Single Contract

The entire protocol has been consolidated into **1 single Intelligent Contract**:

- **[`contracts/claim_verdict.py`](file:///c:/DEV%20Panda/ClaimVerdict/contracts/claim_verdict.py)** (`ClaimVerdict`):
  - **Policy Pool Escrow**: Manages policy pool creation and native GEN deposits (`gl.message.value`).
  - **Claim Registry**: Stores claim submissions with evidence and independent reference URLs.
  - **AI Consensus Adjudication**: Executes `gl.vm.run_nondet(leader_fn, validator_fn)` to evaluate evidence against independent sources.
  - **Native GEN Payout**: Executes `gl.get_contract_at(claimant).emit_transfer(value=u256(payout))` directly to claimants.
  - **Reputation Tracking**: Calculates claimant compliance history and pool payout statistics.

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

---

## 🚀 GenLayer Studio Deployment Guide

1. Open **GenLayer Studio** $\rightarrow$ **Run & Debug** panel.
2. Open [`contracts/claim_verdict.py`](file:///c:/DEV%20Panda/ClaimVerdict/contracts/claim_verdict.py).
3. Click **Deploy**.
4. Confirm `Result: SUCCESS` and copy the deployed contract address.
5. Paste the address into `frontend/.env.local`:
   ```env
   VITE_CLAIM_COURT_ADDRESS=0x...
   ```
6. Run local app:
   ```bash
   cd frontend
   npm run dev
   ```
