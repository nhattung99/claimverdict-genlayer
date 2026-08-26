# v0.2.16
# { "Depends": "py-genlayer:132536jbnxkd1axfxg5rpfr5b60cr11adm2y4r90hgn0l59qsp9w" }
from genlayer import *
from dataclasses import dataclass
import json

@allow_storage
@dataclass
class PolicyPool:
    operator: Address
    coverage_type: str
    criteria: DynArray[str]
    max_payout_per_claim: bigint
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

def _parse_json_verdict(raw_data) -> dict:
    if isinstance(raw_data, dict):
        comp = int(raw_data.get("compliance_pct", 0))
        conf = int(raw_data.get("confidence", 0))
        reason = str(raw_data.get("reason", "No reason provided"))
        return {
            "compliance_pct": max(0, min(100, comp)),
            "confidence": max(0, min(100, conf)),
            "reason": reason
        }

    cleaned = str(raw_data).strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
    except Exception:
        raise UserError("Invalid LLM verdict JSON format")

    if not isinstance(data, dict):
        raise UserError("LLM verdict format must be a JSON object")

    comp = int(data.get("compliance_pct", 0))
    conf = int(data.get("confidence", 0))
    reason = str(data.get("reason", "No reason provided"))

    return {
        "compliance_pct": max(0, min(100, comp)),
        "confidence": max(0, min(100, conf)),
        "reason": reason
    }

class Contract(gl.Contract):
    owner: Address
    pool_counter: bigint
    claim_counter: bigint
    treasury_address: Address
    reputation_address: Address
    pools: TreeMap[str, PolicyPool]
    claims: TreeMap[str, Claim]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.pool_counter = bigint(0)
        self.claim_counter = bigint(0)
        self.treasury_address = Address("0x0000000000000000000000000000000000000000")
        self.reputation_address = Address("0x0000000000000000000000000000000000000000")

    @gl.public.write
    def set_config(self, treasury_address: Address, reputation_address: Address) -> None:
        if gl.message.sender_address != self.owner:
            raise UserError("Only owner can set config")
        self.treasury_address = treasury_address
        self.reputation_address = reputation_address

    @gl.public.write
    def create_policy_pool(self, coverage_type: str, criteria: DynArray[str], max_payout_per_claim: bigint) -> str:
        if not coverage_type or len(coverage_type.strip()) == 0:
            raise UserError("Coverage type cannot be empty")
        if len(criteria) == 0:
            raise UserError("Policy pool must have at least one eligibility criterion")
        if max_payout_per_claim <= bigint(0):
            raise UserError("Max payout per claim must be greater than 0")

        pool_id = str(self.pool_counter)
        self.pool_counter = self.pool_counter + bigint(1)

        pool = PolicyPool(
            operator=gl.message.sender_address,
            coverage_type=coverage_type,
            criteria=criteria,
            max_payout_per_claim=max_payout_per_claim,
            active=True
        )
        self.pools[pool_id] = pool
        return pool_id

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

        claim_id = str(self.claim_counter)
        self.claim_counter = self.claim_counter + bigint(1)

        # Check treasury balance for pool
        status = "SUBMITTED"
        if self.treasury_address != Address("0x0000000000000000000000000000000000000000"):
            treasury = gl.get_contract_at(self.treasury_address)
            pool_balance = treasury.get_pool_balance(pool_id)
            if pool_balance < claimed_amount:
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
            verdict_reason="" if status == "SUBMITTED" else "Insufficient policy pool balance in treasury",
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
            raise UserError("Can only add evidence to DISPUTED claims")

        for url in additional_evidence_urls:
            claim.evidence_urls.append(url)
        for url in additional_reference_urls:
            claim.reference_urls.append(url)

        claim.status = "SUBMITTED"
        claim.verdict_reason = "Supplemental evidence submitted for re-evaluation"
        self.claims[claim_id] = claim

    @gl.public.write
    def resolve_claim(self, claim_id: str) -> None:
        if claim_id not in self.claims:
            raise UserError("Claim does not exist")
        claim = self.claims[claim_id]

        if claim.status != "SUBMITTED":
            raise UserError("Claim not ready for resolution")

        pool = self.pools[claim.pool_id]

        # Double check treasury balance before running LLM
        if self.treasury_address != Address("0x0000000000000000000000000000000000000000"):
            treasury = gl.get_contract_at(self.treasury_address)
            pool_balance = treasury.get_pool_balance(claim.pool_id)
            if pool_balance == bigint(0):
                claim.status = "REJECTED_NO_FUNDS"
                claim.verdict_reason = "Policy pool has zero balance in treasury"
                self.claims[claim_id] = claim
                return

        criteria_list = list(pool.criteria)
        evidence_urls_list = list(claim.evidence_urls)
        reference_urls_list = list(claim.reference_urls)

        def leader_fn() -> dict:
            evidence_contents = []
            for url in evidence_urls_list:
                try:
                    res = gl.nondet.web.render(url)
                    body_text = res.body if hasattr(res, 'body') else str(res)
                    evidence_contents.append(f"Source [{url}]: {body_text}")
                except Exception as e:
                    raise UserError(f"Failed to fetch evidence URL: {url}")

            reference_contents = []
            for url in reference_urls_list:
                try:
                    res = gl.nondet.web.render(url)
                    body_text = res.body if hasattr(res, 'body') else str(res)
                    reference_contents.append(f"Independent Source [{url}]: {body_text}")
                except Exception as e:
                    raise UserError(f"Failed to fetch reference URL: {url}")

            prompt = f"""You are an expert insurance claim adjudicator.
Policy Type: "{pool.coverage_type}"
Policy Criteria: {criteria_list}
Claimant Incident Statement: "{claim.incident_description}"
Claimed Amount: {claim.claimed_amount}

Claimant Submitted Evidence:
{evidence_contents}

Independent Verification Sources:
{reference_contents}

Instructions:
1. Evaluate each policy criterion against the evidence and independent reference sources.
2. If independent reference sources contradict or fail to verify claimant evidence, reduce compliance_pct significantly.
3. Determine:
   - compliance_pct: integer 0-100 indicating percentage of claim validity.
   - confidence: integer 0-100 indicating certainty of verdict.
   - reason: clear narrative summary explaining the verdict.

Return ONLY a JSON object formatted as follows, without markdown or code fences:
{{"compliance_pct": 85, "confidence": 90, "reason": "Detailed justification here..."}}"""

            raw = gl.nondet.exec_prompt(prompt)
            return _parse_json_verdict(raw)

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            try:
                my_res = leader_fn()
            except Exception:
                return False
            leader_val = leader_res.value
            return abs(my_res["compliance_pct"] - leader_val["compliance_pct"]) <= 5

        result = gl.vm.run_nondet(leader_fn, validator_fn)

        comp_pct = u256(result["compliance_pct"])
        confidence = u256(result["confidence"])
        reason = result["reason"]

        claim.compliance_pct = comp_pct
        claim.confidence = confidence
        claim.verdict_reason = reason

        if result["confidence"] < 60:
            claim.status = "DISPUTED"
            self.claims[claim_id] = claim
            return

        claim.status = "RESOLVED"

        # Calculate payout
        base_amount = claim.claimed_amount
        if base_amount > pool.max_payout_per_claim:
            base_amount = pool.max_payout_per_claim

        payout = (base_amount * bigint(result["compliance_pct"])) // bigint(100)
        claim.payout_amount = payout

        # Execute payout from treasury if payout > 0
        if payout > bigint(0) and not claim.paid_out:
            if self.treasury_address != Address("0x0000000000000000000000000000000000000000"):
                treasury = gl.get_contract_at(self.treasury_address)
                treasury.payout(claim.pool_id, claim.claimant, payout)
                claim.paid_out = True

        # Record reputation stats
        if self.reputation_address != Address("0x0000000000000000000000000000000000000000"):
            reputation = gl.get_contract_at(self.reputation_address)
            reputation.record_claim_verdict(claim.claimant, claim.pool_id, comp_pct, payout)

        self.claims[claim_id] = claim

    @gl.public.view
    def get_pool(self, pool_id: str) -> dict:
        if pool_id not in self.pools:
            raise UserError("Policy pool does not exist")
        p = self.pools[pool_id]
        return {
            "operator": p.operator,
            "coverage_type": p.coverage_type,
            "criteria": list(p.criteria),
            "max_payout_per_claim": p.max_payout_per_claim,
            "active": p.active
        }

    @gl.public.view
    def get_claim(self, claim_id: str) -> dict:
        if claim_id not in self.claims:
            raise UserError("Claim does not exist")
        c = self.claims[claim_id]
        return {
            "pool_id": c.pool_id,
            "claimant": c.claimant,
            "claimed_amount": c.claimed_amount,
            "incident_description": c.incident_description,
            "evidence_urls": list(c.evidence_urls),
            "reference_urls": list(c.reference_urls),
            "status": c.status,
            "compliance_pct": c.compliance_pct,
            "payout_amount": c.payout_amount,
            "verdict_reason": c.verdict_reason,
            "confidence": c.confidence,
            "paid_out": c.paid_out
        }
