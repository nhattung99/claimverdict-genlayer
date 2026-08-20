# v0.2.16
# {
#   "Seq": [
#     { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
#   ]
# }

import json
from dataclasses import dataclass
from genlayer import *

@allow_storage
@dataclass
class PolicyPool:
    operator: Address
    coverage_type: str
    criteria: DynArray[str]
    max_payout_per_claim: bigint
    pool_balance: bigint
    active: bool

@allow_storage
@dataclass
class Claim:
    pool_id: str
    claimant: Address
    claimed_amount: bigint
    incident_description: str
    evidence_urls: DynArray[str]
    reference_urls: DynArray[str]
    status: str  # "SUBMITTED" | "RESOLVED" | "DISPUTED" | "REJECTED_NO_FUNDS"
    compliance_pct: u256
    payout_amount: bigint
    verdict_reason: str
    confidence: u256
    paid_out: bool

def _parse_verdict_json(raw_text) -> dict:
    if isinstance(raw_text, dict):
        data = raw_text
    else:
        cleaned = str(raw_text).strip()
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            if len(lines) >= 2 and lines[0].startswith("```"):
                lines = lines[1:]
            if len(lines) >= 1 and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()
        
        try:
            data = json.loads(cleaned)
        except Exception as e:
            raise UserError(f"Invalid JSON returned by AI adjudicator: {str(e)}")

    if not isinstance(data, dict):
        raise UserError("AI verdict response must be a JSON object")

    if "compliance_pct" not in data or "confidence" not in data or "reason" not in data:
        raise UserError("Missing required keys (compliance_pct, confidence, reason) in AI verdict response")

    comp = int(data["compliance_pct"])
    conf = int(data["confidence"])

    if comp < 0 or comp > 100:
        raise UserError(f"compliance_pct out of bounds: {comp}")
    if conf < 0 or conf > 100:
        raise UserError(f"confidence out of bounds: {conf}")

    return {
        "compliance_pct": comp,
        "confidence": conf,
        "reason": str(data["reason"]),
    }

def _format_address_str(addr) -> str:
    if hasattr(addr, 'as_hex'):
        return addr.as_hex.lower()
    if isinstance(addr, bytes):
        return ("0x" + addr.hex()).lower()
    s = str(addr).lower()
    if not s.startswith("0x") and len(s) == 40:
        return "0x" + s
    return s

class ClaimVerdict(gl.Contract):
    owner: Address
    pool_counter: bigint
    claim_counter: bigint
    pools: TreeMap[str, PolicyPool]
    claims: TreeMap[str, Claim]
    pool_balances: TreeMap[str, bigint]
    claimant_total_claims: TreeMap[str, bigint]
    claimant_sum_compliance: TreeMap[str, bigint]
    pool_total_claims: TreeMap[str, bigint]
    pool_total_payouts: TreeMap[str, bigint]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.pool_counter = bigint(0)
        self.claim_counter = bigint(0)

    @gl.public.write
    def create_policy_pool(self, coverage_type: str, criteria: DynArray[str], max_payout_per_claim: bigint) -> str:
        if not coverage_type or len(coverage_type.strip()) == 0:
            raise UserError("Coverage type cannot be empty")
        if len(criteria) == 0:
            raise UserError("Policy pool must have at least one eligibility criterion")
        if max_payout_per_claim <= bigint(0):
            raise UserError("Max payout per claim must be greater than 0")

        self.pool_counter += bigint(1)
        pool_id = str(self.pool_counter)

        pool = PolicyPool(
            operator=gl.message.sender_address,
            coverage_type=coverage_type,
            criteria=criteria,
            max_payout_per_claim=max_payout_per_claim,
            pool_balance=bigint(0),
            active=True
        )
        self.pools[pool_id] = pool
        self.pool_balances[pool_id] = bigint(0)
        return pool_id

    @gl.public.write
    def deposit_to_pool(self, pool_id: str) -> None:
        if pool_id not in self.pools:
            raise UserError("Policy pool does not exist")

        deposit_amount = gl.message.value
        if deposit_amount <= bigint(0):
            raise UserError("Deposit amount must be greater than 0")

        pool = self.pools[pool_id]
        pool.pool_balance += deposit_amount
        self.pools[pool_id] = pool

        current_bal = self.pool_balances.get(pool_id, bigint(0))
        self.pool_balances[pool_id] = current_bal + deposit_amount

    @gl.public.write
    def submit_claim(self, pool_id: str, claimed_amount: bigint, incident_description: str, evidence_urls: DynArray[str], reference_urls: DynArray[str]) -> str:
        if pool_id not in self.pools:
            raise UserError("Policy pool does not exist")
        pool = self.pools[pool_id]
        if not pool.active:
            raise UserError("Policy pool is inactive")

        if claimed_amount <= bigint(0):
            raise UserError("Claimed amount must be greater than 0")
        if len(evidence_urls) < 1:
            raise UserError("At least 1 evidence URL required")
        if len(reference_urls) < 2:
            raise UserError("At least 2 independent reference URLs required")

        self.claim_counter += bigint(1)
        claim_id = str(self.claim_counter)

        pool_bal = self.pool_balances.get(pool_id, bigint(0))
        status = "SUBMITTED"
        if pool_bal < claimed_amount:
            status = "REJECTED_NO_FUNDS"

        claim = Claim(
            pool_id=pool_id,
            claimant=gl.message.sender_address,
            claimed_amount=claimed_amount,
            incident_description=incident_description,
            evidence_urls=evidence_urls,
            reference_urls=reference_urls,
            status=status,
            compliance_pct=u256(0),
            payout_amount=bigint(0),
            verdict_reason="" if status == "SUBMITTED" else "Insufficient policy pool balance",
            confidence=u256(0),
            paid_out=False
        )
        self.claims[claim_id] = claim
        return claim_id

    @gl.public.write
    def add_evidence(self, claim_id: str, additional_evidence_urls: DynArray[str], additional_reference_urls: DynArray[str]) -> None:
        if claim_id not in self.claims:
            raise UserError("Claim does not exist")
        claim = self.claims[claim_id]
        if claim.claimant != gl.message.sender_address:
            raise UserError("Only claimant can add evidence")
        if claim.status != "DISPUTED":
            raise UserError(f"Can only add evidence to DISPUTED claims, current status: {claim.status}")

        for url in additional_evidence_urls:
            claim.evidence_urls.append(url)
        for url in additional_reference_urls:
            claim.reference_urls.append(url)

        claim.status = "SUBMITTED"
        claim.verdict_reason = "Supplemental evidence attached for re-evaluation"
        self.claims[claim_id] = claim

    @gl.public.write
    def resolve_claim(self, claim_id: str) -> None:
        if claim_id not in self.claims:
            raise UserError("Claim does not exist")
        claim = self.claims[claim_id]

        if claim.status != "SUBMITTED":
            raise UserError(f"Claim not ready for resolution (status: {claim.status})")

        pool = self.pools[claim.pool_id]
        pool_bal = self.pool_balances.get(claim.pool_id, bigint(0))
        if pool_bal == bigint(0):
            claim.status = "REJECTED_NO_FUNDS"
            claim.verdict_reason = "Policy pool has zero balance in escrow"
            self.claims[claim_id] = claim
            return

        criteria_list = list(pool.criteria)
        evidence_urls_list = list(claim.evidence_urls)
        reference_urls_list = list(claim.reference_urls)

        def leader_fn() -> dict:
            evidence_contents = []
            for u in evidence_urls_list:
                try:
                    res = gl.nondet.web.render(u)
                    body_text = res.body if hasattr(res, 'body') else str(res)
                    evidence_contents.append(f"Evidence [{u}]: {body_text}")
                except Exception as e:
                    evidence_contents.append(f"Evidence [{u}]: (failed to fetch: {str(e)})")

            reference_contents = []
            for u in reference_urls_list:
                try:
                    res = gl.nondet.web.render(u)
                    body_text = res.body if hasattr(res, 'body') else str(res)
                    reference_contents.append(f"Independent Reference [{u}]: {body_text}")
                except Exception as e:
                    reference_contents.append(f"Independent Reference [{u}]: (failed to fetch: {str(e)})")

            prompt = f"""You are an impartial AI insurance claim adjudicator on GenLayer.
Policy Type: "{pool.coverage_type}"
Policy Eligibility Criteria: {criteria_list}
Claimant Incident Statement: "{claim.incident_description}"
Claimed Amount: {claim.claimed_amount}

Claimant Submitted Evidence:
{evidence_contents}

Independent Verification Sources:
{reference_contents}

Evaluate criteria compliance based on independent reference sources.
Determine:
1. "compliance_pct": Integer 0 to 100 representing percentage of valid claim compliance.
2. "confidence": Integer 0 to 100 representing certainty in this verdict.
3. "reason": A detailed narrative summary explaining the verdict.

Return ONLY a valid raw JSON object with NO markdown formatting, NO backticks:
{{"compliance_pct": <0-100>, "confidence": <0-100>, "reason": "<explanation>"}}"""

            raw = gl.nondet.exec_prompt(prompt)
            return _parse_verdict_json(raw)

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            leader_val_dict = leader_res.calldata
            if not isinstance(leader_val_dict, dict) or "compliance_pct" not in leader_val_dict or "confidence" not in leader_val_dict:
                return False
            try:
                my_res = leader_fn()
            except Exception:
                return False

            leader_compliance = int(leader_val_dict["compliance_pct"])
            leader_confidence = int(leader_val_dict["confidence"])
            my_compliance = int(my_res["compliance_pct"])
            my_confidence = int(my_res["confidence"])

            # 1. Compliance score agreement within tolerance ±5
            compliance_match = abs(my_compliance - leader_compliance) <= 5

            # 2. Confidence branch agreement: Both leader and validator MUST agree on whether confidence >= 60.
            #    This is critical because confidence >= 60 selects the payable branch (RESOLVED vs DISPUTED).
            leader_payable = leader_confidence >= 60
            my_payable = my_confidence >= 60
            branch_match = (leader_payable == my_payable)

            return compliance_match and branch_match

        result = gl.vm.run_nondet(leader_fn, validator_fn)
        result_data = result.calldata if hasattr(result, 'calldata') else result

        comp_pct = u256(result_data["compliance_pct"])
        confidence = u256(result_data["confidence"])
        reason = str(result_data["reason"])

        claim.compliance_pct = comp_pct
        claim.confidence = confidence
        claim.verdict_reason = reason

        if confidence < u256(60):
            claim.status = "DISPUTED"
            self.claims[claim_id] = claim
            return

        base_amount = claim.claimed_amount
        if base_amount > pool.max_payout_per_claim:
            base_amount = pool.max_payout_per_claim

        payout = (base_amount * bigint(result_data["compliance_pct"])) // bigint(100)
        claim.payout_amount = payout

        # Escrow Reservation & Transfer Execution
        current_pool_bal = self.pool_balances.get(claim.pool_id, bigint(0))
        if payout > bigint(0):
            if current_pool_bal < payout:
                # Escrow balance insufficient: cannot resolve claim or pay out
                claim.status = "REJECTED_NO_FUNDS"
                claim.verdict_reason += " (Escrow pool balance insufficient for payout)"
                claim.paid_out = False
                self.claims[claim_id] = claim
                return

            # Pre-reserve/deduct payout from pool escrow balance before transfer
            self.pool_balances[claim.pool_id] = current_pool_bal - payout
            pool.pool_balance -= payout
            self.pools[claim.pool_id] = pool

            try:
                # Attempt native transfer to claimant using GenLayer VM emit_transfer
                gl.get_contract_at(claim.claimant).emit_transfer(value=u256(payout))
                claim.paid_out = True
                claim.status = "RESOLVED"

                # Update pool payout stats only on successful transfer
                p_total = self.pool_total_claims.get(claim.pool_id, bigint(0))
                p_payouts = self.pool_total_payouts.get(claim.pool_id, bigint(0))
                self.pool_total_claims[claim.pool_id] = p_total + bigint(1)
                self.pool_total_payouts[claim.pool_id] = p_payouts + payout
            except Exception as e:
                # Transfer failed: Rollback reserved escrow balance
                self.pool_balances[claim.pool_id] = current_pool_bal
                pool.pool_balance += payout
                self.pools[claim.pool_id] = pool

                claim.paid_out = False
                claim.status = "PAYOUT_FAILED"
                claim.verdict_reason += f" (Payout transfer failed: {str(e)})"
                self.claims[claim_id] = claim
                return
        else:
            # Payout is 0 (0% compliance score)
            claim.paid_out = True
            claim.status = "RESOLVED"

        # Update reputation stats
        c_key = _format_address_str(claim.claimant)
        self.claimant_total_claims[c_key] = self.claimant_total_claims.get(c_key, bigint(0)) + bigint(1)
        self.claimant_sum_compliance[c_key] = self.claimant_sum_compliance.get(c_key, bigint(0)) + bigint(result_data["compliance_pct"])

        self.claims[claim_id] = claim

    @gl.public.write
    def retry_resolution(self, claim_id: str) -> None:
        if claim_id not in self.claims:
            raise UserError("Claim does not exist")
        claim = self.claims[claim_id]

        sender = gl.message.sender_address
        pool = self.pools[claim.pool_id]
        if sender != claim.claimant and sender != pool.operator and sender != self.owner:
            raise UserError("Only claimant or pool operator can retry claim resolution")

        if claim.status not in ["PAYOUT_FAILED", "REJECTED_NO_FUNDS"]:
            raise UserError(f"Cannot retry resolution for claim in status: {claim.status}")

        # If AI verdict was already rendered (confidence >= 60), retry payout execution directly without re-running AI consensus
        if claim.confidence >= u256(60) and claim.compliance_pct > u256(0):
            base_amount = claim.claimed_amount
            if base_amount > pool.max_payout_per_claim:
                base_amount = pool.max_payout_per_claim

            payout = (base_amount * bigint(claim.compliance_pct)) // bigint(100)
            claim.payout_amount = payout

            current_pool_bal = self.pool_balances.get(claim.pool_id, bigint(0))
            if payout > bigint(0):
                if current_pool_bal < payout:
                    claim.status = "REJECTED_NO_FUNDS"
                    claim.verdict_reason = "Policy pool balance remains insufficient for payout"
                    claim.paid_out = False
                    self.claims[claim_id] = claim
                    return

                # Reserve escrow balance
                self.pool_balances[claim.pool_id] = current_pool_bal - payout
                pool.pool_balance -= payout
                self.pools[claim.pool_id] = pool

                try:
                    gl.get_contract_at(claim.claimant).emit_transfer(value=u256(payout))
                    claim.paid_out = True
                    claim.status = "RESOLVED"
                    claim.verdict_reason += " (Payout successfully executed on retry)"

                    p_total = self.pool_total_claims.get(claim.pool_id, bigint(0))
                    p_payouts = self.pool_total_payouts.get(claim.pool_id, bigint(0))
                    self.pool_total_claims[claim.pool_id] = p_total + bigint(1)
                    self.pool_total_payouts[claim.pool_id] = p_payouts + payout
                except Exception as e:
                    # Rollback on transfer failure
                    self.pool_balances[claim.pool_id] = current_pool_bal
                    pool.pool_balance += payout
                    self.pools[claim.pool_id] = pool

                    claim.paid_out = False
                    claim.status = "PAYOUT_FAILED"
                    claim.verdict_reason += f" (Retry payout transfer failed: {str(e)})"
                    self.claims[claim_id] = claim
                    return
            else:
                claim.paid_out = True
                claim.status = "RESOLVED"

            self.claims[claim_id] = claim
        else:
            # AI consensus not run yet or needs re-evaluation: reset to SUBMITTED and re-run resolution
            claim.status = "SUBMITTED"
            claim.verdict_reason = "Re-queued for resolution retry"
            self.claims[claim_id] = claim
            self.resolve_claim(claim_id)

    @gl.public.view
    def get_pool(self, pool_id: str) -> dict:
        if pool_id not in self.pools:
            return {}
        p = self.pools[pool_id]
        return {
            "operator": str(p.operator),
            "coverage_type": str(p.coverage_type),
            "criteria": [str(c) for c in p.criteria],
            "max_payout_per_claim": str(p.max_payout_per_claim),
            "pool_balance": str(p.pool_balance),
            "active": bool(p.active)
        }

    @gl.public.view
    def get_claim(self, claim_id: str) -> dict:
        if claim_id not in self.claims:
            return {}
        c = self.claims[claim_id]
        return {
            "pool_id": str(c.pool_id),
            "claimant": str(c.claimant),
            "claimed_amount": str(c.claimed_amount),
            "incident_description": str(c.incident_description),
            "evidence_urls": [str(u) for u in c.evidence_urls],
            "reference_urls": [str(u) for u in c.reference_urls],
            "status": str(c.status),
            "compliance_pct": int(c.compliance_pct),
            "payout_amount": str(c.payout_amount),
            "verdict_reason": str(c.verdict_reason),
            "confidence": int(c.confidence),
            "paid_out": bool(c.paid_out)
        }

    @gl.public.view
    def get_pool_balance(self, pool_id: str) -> str:
        if pool_id not in self.pool_balances:
            return "0"
        return str(self.pool_balances[pool_id])

    @gl.public.view
    def get_claimant_reputation(self, claimant: Address) -> dict:
        c_key = _format_address_str(claimant)
        total = self.claimant_total_claims.get(c_key, bigint(0))
        sum_comp = self.claimant_sum_compliance.get(c_key, bigint(0))
        avg_comp = bigint(0) if total == bigint(0) else (sum_comp // total)
        return {
            "total_claims": int(total),
            "avg_compliance_pct": int(avg_comp)
        }

    @gl.public.view
    def get_pool_stats(self, pool_id: str) -> dict:
        total_claims = self.pool_total_claims.get(pool_id, bigint(0))
        total_payouts = self.pool_total_payouts.get(pool_id, bigint(0))
        return {
            "total_claims": int(total_claims),
            "total_payouts": str(total_payouts)
        }
