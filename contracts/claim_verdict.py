# v0.2.16
# {
#   "Seq": [
#     { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
#   ]
# }

import json
from dataclasses import dataclass
from genlayer import *

MIN_AUTHORITATIVE_SOURCES = 2
MIN_FETCHED_CHARS = 20


@allow_storage
@dataclass
class PolicyPool:
    operator: Address
    coverage_type: str
    criteria: DynArray[str]
    authoritative_source_urls: DynArray[str]
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
    status: str
    compliance_pct: u256
    payout_amount: bigint
    verdict_reason: str
    confidence: u256
    paid_out: bool
    authoritative_retrieved: u256


def _format_address_str(addr) -> str:
    if hasattr(addr, "as_hex"):
        return addr.as_hex.lower()
    if isinstance(addr, bytes):
        return ("0x" + addr.hex()).lower()
    s = str(addr).lower()
    if not s.startswith("0x") and len(s) == 40:
        return "0x" + s
    return s


def _enrollment_key(pool_id: str, addr) -> str:
    return str(pool_id) + ":" + _format_address_str(addr)


def _extract_host(url: str) -> str:
    raw = str(url).strip()
    lower = raw.lower()
    if not (lower.startswith("https://") or lower.startswith("http://")):
        raise UserError("Every evidence URL must start with http:// or https://")
    rest = lower.split("://", 1)[1]
    host = rest.split("/")[0].split("?")[0].split("#")[0]
    if host.startswith("www."):
        host = host[4:]
    if ":" in host:
        host = host.split(":")[0]
    if len(host) < 3 or "." not in host:
        raise UserError("Invalid URL host: " + raw)
    return host


def _normalize_host(host: str) -> str:
    h = str(host).strip().lower()
    if h.startswith("www."):
        h = h[4:]
    if h.startswith("https://") or h.startswith("http://"):
        return _extract_host(h)
    if len(h) < 3 or "." not in h:
        raise UserError("Invalid authoritative host: " + str(host))
    return h


def _hosts_overlap(a: str, b: str) -> bool:
    return a == b or a.endswith("." + b) or b.endswith("." + a)


def _host_on_allowlist(host: str, allowed: list) -> bool:
    for item in allowed:
        allowed_host = _normalize_host(str(item))
        if _hosts_overlap(host, allowed_host):
            return True
    return False


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
            raise UserError("Invalid JSON returned by AI adjudicator: " + str(e))

    if not isinstance(data, dict):
        raise UserError("AI verdict response must be a JSON object")
    if "compliance_pct" not in data or "confidence" not in data or "reason" not in data:
        raise UserError("Missing required keys (compliance_pct, confidence, reason) in AI verdict response")

    comp = int(data["compliance_pct"])
    conf = int(data["confidence"])
    if comp < 0 or comp > 100:
        raise UserError("compliance_pct out of bounds: " + str(comp))
    if conf < 0 or conf > 100:
        raise UserError("confidence out of bounds: " + str(conf))

    return {
        "compliance_pct": comp,
        "confidence": conf,
        "reason": str(data["reason"]),
        "authoritative_ok": bool(data.get("authoritative_ok", False)),
        "retrieved_count": int(data.get("retrieved_count", 0)),
    }


def _try_fetch_body(url: str) -> str:
    try:
        res = gl.nondet.web.render(url)
        body = res.body if hasattr(res, "body") else str(res)
    except Exception:
        return ""
    text = str(body).strip()
    if len(text) < MIN_FETCHED_CHARS:
        return ""
    head = text[:240].lower()
    if "404" in head and ("not found" in head or "does not exist" in head):
        return ""
    return text


class Contract(gl.Contract):
    owner: Address
    pool_counter: bigint
    claim_counter: bigint
    pools: TreeMap[str, PolicyPool]
    claims: TreeMap[str, Claim]
    pool_balances: TreeMap[str, bigint]
    enrollments: TreeMap[str, bool]
    open_claim_by_holder: TreeMap[str, str]
    claimant_total_claims: TreeMap[str, bigint]
    claimant_sum_compliance: TreeMap[str, bigint]
    pool_total_claims: TreeMap[str, bigint]
    pool_total_payouts: TreeMap[str, bigint]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.pool_counter = bigint(0)
        self.claim_counter = bigint(0)

    def _require_enrolled(self, pool_id: str, holder) -> None:
        key = _enrollment_key(pool_id, holder)
        if key not in self.enrollments or self.enrollments[key] != True:
            raise UserError("Wallet is not enrolled on this policy pool")

    def _enrolled_source_hosts(self, pool: PolicyPool) -> list:
        hosts = []
        for url in pool.authoritative_source_urls:
            host = _extract_host(str(url))
            for existing in hosts:
                if _hosts_overlap(host, existing):
                    raise UserError("Authoritative sources must be independent (distinct hosts)")
            hosts.append(host)
        if len(hosts) < MIN_AUTHORITATIVE_SOURCES:
            raise UserError("Policy must enroll at least 2 distinct authoritative source URLs")
        return hosts

    def _assert_claimant_evidence_independent(self, pool: PolicyPool, evidence_urls) -> None:
        # Claimant may attach receipts only. They cannot choose or substitute
        # the policy's enrolled authoritative sources.
        auth_hosts = self._enrolled_source_hosts(pool)
        ev_hosts = []
        for url in evidence_urls:
            host = _extract_host(str(url))
            for existing in ev_hosts:
                if _hosts_overlap(host, existing):
                    raise UserError("Claimant evidence URLs must be distinct hosts")
            for auth_host in auth_hosts:
                if _hosts_overlap(host, auth_host):
                    raise UserError("Claimant evidence cannot share a host with enrolled authoritative sources")
            ev_hosts.append(host)

    @gl.public.write.payable
    def create_policy_pool(
        self,
        coverage_type: str,
        criteria: DynArray[str],
        authoritative_source_urls: DynArray[str],
        max_payout_per_claim: bigint,
    ) -> str:
        if not coverage_type or len(coverage_type.strip()) == 0:
            raise UserError("Coverage type cannot be empty")
        if len(criteria) == 0:
            raise UserError("Policy pool must have at least one eligibility criterion")
        if max_payout_per_claim <= bigint(0):
            raise UserError("Max payout per claim must be greater than 0")

        seen_hosts = []
        for url_raw in authoritative_source_urls:
            host = _extract_host(str(url_raw))
            for existing in seen_hosts:
                if _hosts_overlap(host, existing):
                    raise UserError("Authoritative sources must be independent (distinct hosts)")
            seen_hosts.append(host)
        if len(seen_hosts) < MIN_AUTHORITATIVE_SOURCES:
            raise UserError("Policy must enroll at least 2 distinct authoritative source URLs")

        self.pool_counter += bigint(1)
        pool_id = str(self.pool_counter)
        initial = gl.message.value
        if initial < bigint(0):
            raise UserError("Initial deposit cannot be negative")

        pool = PolicyPool(
            operator=gl.message.sender_address,
            coverage_type=coverage_type,
            criteria=criteria,
            authoritative_source_urls=authoritative_source_urls,
            max_payout_per_claim=max_payout_per_claim,
            pool_balance=initial,
            active=True,
        )
        self.pools[pool_id] = pool
        self.pool_balances[pool_id] = initial
        # Operator is enrolled so they can demonstrate the bound-policy flow.
        self.enrollments[_enrollment_key(pool_id, gl.message.sender_address)] = True
        return pool_id

    @gl.public.write
    def enroll_policyholder(self, pool_id: str, holder: Address) -> None:
        if pool_id not in self.pools:
            raise UserError("Policy pool does not exist")
        pool = self.pools[pool_id]
        if gl.message.sender_address != pool.operator and gl.message.sender_address != self.owner:
            raise UserError("Only the pool operator can enroll a covered wallet")
        if not pool.active:
            raise UserError("Policy pool is inactive")
        self.enrollments[_enrollment_key(pool_id, holder)] = True

    @gl.public.write.payable
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
    def submit_claim(
        self,
        pool_id: str,
        claimed_amount: bigint,
        incident_description: str,
        evidence_urls: DynArray[str],
    ) -> str:
        if pool_id not in self.pools:
            raise UserError("Policy pool does not exist")
        pool = self.pools[pool_id]
        if not pool.active:
            raise UserError("Policy pool is inactive")
        if claimed_amount <= bigint(0):
            raise UserError("Claimed amount must be greater than 0")
        if len(evidence_urls) < 1:
            raise UserError("At least 1 claimant evidence URL is required")

        claimant = gl.message.sender_address
        self._require_enrolled(pool_id, claimant)
        self._assert_claimant_evidence_independent(pool, evidence_urls)

        open_key = _enrollment_key(pool_id, claimant)
        if open_key in self.open_claim_by_holder:
            existing_id = str(self.open_claim_by_holder[open_key])
            if existing_id != "" and existing_id in self.claims:
                existing = self.claims[existing_id]
                if existing.status in ["SUBMITTED", "DISPUTED", "PAYOUT_FAILED"]:
                    raise UserError("Open claim already exists on this enrolled policy (no double-claim)")

        self.claim_counter += bigint(1)
        claim_id = str(self.claim_counter)

        pool_bal = self.pool_balances.get(pool_id, bigint(0))
        status = "SUBMITTED"
        reason = ""
        if pool_bal < claimed_amount:
            status = "REJECTED_NO_FUNDS"
            reason = "Insufficient policy pool balance"

        claim = Claim(
            pool_id=pool_id,
            claimant=claimant,
            claimed_amount=claimed_amount,
            incident_description=incident_description,
            evidence_urls=evidence_urls,
            reference_urls=[str(u) for u in pool.authoritative_source_urls],
            status=status,
            compliance_pct=u256(0),
            payout_amount=bigint(0),
            verdict_reason=reason,
            confidence=u256(0),
            paid_out=False,
            authoritative_retrieved=u256(0),
        )
        self.claims[claim_id] = claim
        if status == "SUBMITTED":
            self.open_claim_by_holder[open_key] = claim_id
        return claim_id

    @gl.public.write
    def add_evidence(self, claim_id: str, additional_evidence_urls: DynArray[str]) -> None:
        if claim_id not in self.claims:
            raise UserError("Claim does not exist")
        claim = self.claims[claim_id]
        if claim.claimant != gl.message.sender_address:
            raise UserError("Only claimant can add evidence")
        if claim.status != "DISPUTED":
            raise UserError("Can only add evidence to DISPUTED claims, current status: " + claim.status)
        if len(additional_evidence_urls) < 1:
            raise UserError("At least 1 supplemental evidence URL is required")

        pool = self.pools[claim.pool_id]
        merged_ev = [str(u) for u in claim.evidence_urls] + [str(u) for u in additional_evidence_urls]
        self._assert_claimant_evidence_independent(pool, merged_ev)

        for url in additional_evidence_urls:
            claim.evidence_urls.append(url)
        claim.status = "SUBMITTED"
        claim.verdict_reason = "Supplemental evidence attached for re-evaluation"
        self.claims[claim_id] = claim
        self.open_claim_by_holder[_enrollment_key(claim.pool_id, claim.claimant)] = claim_id

    @gl.public.write
    def resolve_claim(self, claim_id: str) -> None:
        if claim_id not in self.claims:
            raise UserError("Claim does not exist")
        claim = self.claims[claim_id]
        if claim.status != "SUBMITTED":
            raise UserError("Claim not ready for resolution (status: " + claim.status + ")")

        pool = self.pools[claim.pool_id]
        pool_bal = self.pool_balances.get(claim.pool_id, bigint(0))
        if pool_bal == bigint(0):
            claim.status = "REJECTED_NO_FUNDS"
            claim.verdict_reason = "Policy pool has zero balance in escrow"
            self.claims[claim_id] = claim
            return

        criteria_list = list(pool.criteria)
        evidence_urls_list = [str(u) for u in claim.evidence_urls]
        # Fetch the policy's enrolled sources — never claimant-chosen URLs.
        reference_urls_list = [str(u) for u in pool.authoritative_source_urls]
        allowed_hosts = [_extract_host(u) for u in reference_urls_list]
        coverage_type = str(pool.coverage_type)
        incident = str(claim.incident_description)
        claimed_amount = claim.claimed_amount

        def leader_fn() -> dict:
            evidence_contents = []
            evidence_ok = 0
            for u in evidence_urls_list:
                body = _try_fetch_body(u)
                if body == "":
                    evidence_contents.append("Evidence [" + u + "]: RETRIEVAL_FAILED")
                    continue
                evidence_ok += 1
                evidence_contents.append("Evidence [" + u + "]: " + body)

            reference_contents = []
            retrieved_hosts = []
            failed_refs = 0
            for u in reference_urls_list:
                body = _try_fetch_body(u)
                if body == "":
                    failed_refs += 1
                    reference_contents.append("Authoritative Source [" + u + "]: RETRIEVAL_FAILED")
                    continue
                host = _extract_host(u)
                if not _host_on_allowlist(host, allowed_hosts):
                    raise UserError("Retrieved source is not an enrolled authoritative host: " + host)
                independent = True
                for existing in retrieved_hosts:
                    if _hosts_overlap(host, existing):
                        independent = False
                if not independent:
                    raise UserError("Retrieved authoritative sources are not independent")
                retrieved_hosts.append(host)
                reference_contents.append("Authoritative Source [" + u + "]: " + body)

            retrieved_count = len(retrieved_hosts)
            if retrieved_count == 0:
                raise UserError("No enrolled authoritative source could be retrieved (timeout, 404, or empty page)")
            if evidence_ok == 0:
                raise UserError("Claimant evidence URL could not be retrieved")

            authoritative_ok = retrieved_count >= MIN_AUTHORITATIVE_SOURCES and evidence_ok >= 1 and failed_refs == 0

            prompt = f"""You are an impartial AI insurance claim adjudicator on GenLayer.
Policy Type: "{coverage_type}"
Policy Eligibility Criteria: {criteria_list}
Claimant Incident Statement: "{incident}"
Claimed Amount: {claimed_amount}

Claimant Submitted Evidence:
{evidence_contents}

Enrolled Authoritative Verification Sources (must be independent hosts, successfully retrieved):
{reference_contents}

Rules:
- Only use successfully retrieved pages. Do not invent missing sources.
- Authoritative sources are enrolled with the policy; claimant evidence is not a substitute for them.
- If independent sources do not corroborate coverage, lower compliance_pct.

Return ONLY raw JSON with NO markdown:
{{"compliance_pct": <0-100>, "confidence": <0-100>, "reason": "<explanation>", "authoritative_ok": {str(authoritative_ok).lower()}, "retrieved_count": {retrieved_count}}}"""

            raw = gl.nondet.exec_prompt(prompt)
            parsed = _parse_verdict_json(raw)
            parsed["authoritative_ok"] = authoritative_ok
            parsed["retrieved_count"] = retrieved_count
            return parsed

        def validator_fn(leader_res) -> bool:
            # Compare payable MEANING, not free-text reason:
            # 1) compliance within ±5
            # 2) same confidence>=60 branch (RESOLVED vs DISPUTED)
            # 3) same authoritative-retrieval gate (payout is forbidden unless both saw ≥2 distinct successful sources)
            if not isinstance(leader_res, gl.vm.Return):
                return False
            leader_val_dict = leader_res.calldata
            if not isinstance(leader_val_dict, dict):
                return False
            if "compliance_pct" not in leader_val_dict or "confidence" not in leader_val_dict:
                return False
            try:
                my_res = leader_fn()
            except Exception:
                return False

            leader_compliance = int(leader_val_dict["compliance_pct"])
            leader_confidence = int(leader_val_dict["confidence"])
            my_compliance = int(my_res["compliance_pct"])
            my_confidence = int(my_res["confidence"])
            compliance_match = abs(my_compliance - leader_compliance) <= 5
            branch_match = (leader_confidence >= 60) == (my_confidence >= 60)
            leader_auth = bool(leader_val_dict.get("authoritative_ok", False)) and int(leader_val_dict.get("retrieved_count", 0)) >= MIN_AUTHORITATIVE_SOURCES
            my_auth = bool(my_res.get("authoritative_ok", False)) and int(my_res.get("retrieved_count", 0)) >= MIN_AUTHORITATIVE_SOURCES
            return compliance_match and branch_match and (leader_auth == my_auth)

        result = gl.vm.run_nondet(leader_fn, validator_fn)
        result_data = result.calldata if hasattr(result, "calldata") else result

        comp_pct = u256(result_data["compliance_pct"])
        confidence = u256(result_data["confidence"])
        reason = str(result_data["reason"])
        retrieved_count = int(result_data.get("retrieved_count", 0))
        authoritative_ok = bool(result_data.get("authoritative_ok", False)) and retrieved_count >= MIN_AUTHORITATIVE_SOURCES

        claim.compliance_pct = comp_pct
        claim.confidence = confidence
        claim.verdict_reason = reason
        claim.authoritative_retrieved = u256(retrieved_count)

        # Hard payout gate: distinct authoritative pages must have been retrieved successfully.
        if (not authoritative_ok) or retrieved_count < MIN_AUTHORITATIVE_SOURCES:
            claim.status = "DISPUTED"
            claim.paid_out = False
            claim.verdict_reason = reason + " (Payout blocked: need ≥2 distinct enrolled sources retrieved successfully)"
            self.claims[claim_id] = claim
            return

        if confidence < u256(60):
            claim.status = "DISPUTED"
            self.claims[claim_id] = claim
            return

        base_amount = claim.claimed_amount
        if base_amount > pool.max_payout_per_claim:
            base_amount = pool.max_payout_per_claim
        payout = (base_amount * bigint(result_data["compliance_pct"])) // bigint(100)
        claim.payout_amount = payout

        current_pool_bal = self.pool_balances.get(claim.pool_id, bigint(0))
        holder_key = _enrollment_key(claim.pool_id, claim.claimant)
        if payout > bigint(0):
            if current_pool_bal < payout:
                claim.status = "REJECTED_NO_FUNDS"
                claim.verdict_reason += " (Escrow pool balance insufficient for payout)"
                claim.paid_out = False
                self.claims[claim_id] = claim
                return

            self.pool_balances[claim.pool_id] = current_pool_bal - payout
            pool.pool_balance -= payout
            self.pools[claim.pool_id] = pool
            try:
                gl.get_contract_at(claim.claimant).emit_transfer(value=u256(payout))
                claim.paid_out = True
                claim.status = "RESOLVED"
                p_total = self.pool_total_claims.get(claim.pool_id, bigint(0))
                p_payouts = self.pool_total_payouts.get(claim.pool_id, bigint(0))
                self.pool_total_claims[claim.pool_id] = p_total + bigint(1)
                self.pool_total_payouts[claim.pool_id] = p_payouts + payout
                if holder_key in self.open_claim_by_holder:
                    self.open_claim_by_holder[holder_key] = ""
            except Exception as e:
                self.pool_balances[claim.pool_id] = current_pool_bal
                pool.pool_balance += payout
                self.pools[claim.pool_id] = pool
                claim.paid_out = False
                claim.status = "PAYOUT_FAILED"
                claim.verdict_reason += " (Payout transfer failed: " + str(e) + ")"
                self.claims[claim_id] = claim
                return
        else:
            claim.paid_out = True
            claim.status = "RESOLVED"
            if holder_key in self.open_claim_by_holder:
                self.open_claim_by_holder[holder_key] = ""

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
            raise UserError("Cannot retry resolution for claim in status: " + claim.status)

        if claim.confidence >= u256(60) and claim.authoritative_retrieved >= u256(MIN_AUTHORITATIVE_SOURCES) and claim.compliance_pct > u256(0):
            base_amount = claim.claimed_amount
            if base_amount > pool.max_payout_per_claim:
                base_amount = pool.max_payout_per_claim
            payout = (base_amount * bigint(claim.compliance_pct)) // bigint(100)
            claim.payout_amount = payout
            current_pool_bal = self.pool_balances.get(claim.pool_id, bigint(0))
            holder_key = _enrollment_key(claim.pool_id, claim.claimant)
            if payout > bigint(0):
                if current_pool_bal < payout:
                    claim.status = "REJECTED_NO_FUNDS"
                    claim.verdict_reason = "Policy pool balance remains insufficient for payout"
                    claim.paid_out = False
                    self.claims[claim_id] = claim
                    return
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
                    if holder_key in self.open_claim_by_holder:
                        self.open_claim_by_holder[holder_key] = ""
                except Exception as e:
                    self.pool_balances[claim.pool_id] = current_pool_bal
                    pool.pool_balance += payout
                    self.pools[claim.pool_id] = pool
                    claim.paid_out = False
                    claim.status = "PAYOUT_FAILED"
                    claim.verdict_reason += " (Retry payout transfer failed: " + str(e) + ")"
                    self.claims[claim_id] = claim
                    return
            else:
                claim.paid_out = True
                claim.status = "RESOLVED"
                if holder_key in self.open_claim_by_holder:
                    self.open_claim_by_holder[holder_key] = ""
            self.claims[claim_id] = claim
        else:
            claim.status = "SUBMITTED"
            claim.verdict_reason = "Re-queued for resolution retry"
            self.claims[claim_id] = claim
            self.resolve_claim(claim_id)

    @gl.public.view
    def get_pool(self, pool_id: str) -> dict:
        if pool_id not in self.pools:
            return {}
        p = self.pools[pool_id]
        auth_urls = [str(u) for u in p.authoritative_source_urls]
        return {
            "operator": str(p.operator),
            "coverage_type": str(p.coverage_type),
            "criteria": [str(c) for c in p.criteria],
            "authoritative_source_urls": auth_urls,
            "allowed_source_hosts": [_extract_host(u) for u in auth_urls],
            "max_payout_per_claim": str(p.max_payout_per_claim),
            "pool_balance": str(p.pool_balance),
            "active": bool(p.active),
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
            "paid_out": bool(c.paid_out),
            "authoritative_retrieved": int(c.authoritative_retrieved),
        }

    @gl.public.view
    def get_pool_balance(self, pool_id: str) -> str:
        if pool_id not in self.pool_balances:
            return "0"
        return str(self.pool_balances[pool_id])

    @gl.public.view
    def is_enrolled(self, pool_id: str, holder: Address) -> bool:
        key = _enrollment_key(pool_id, holder)
        return key in self.enrollments and self.enrollments[key] == True

    @gl.public.view
    def get_claimant_reputation(self, claimant: Address) -> dict:
        c_key = _format_address_str(claimant)
        total = self.claimant_total_claims.get(c_key, bigint(0))
        sum_comp = self.claimant_sum_compliance.get(c_key, bigint(0))
        avg_comp = bigint(0) if total == bigint(0) else (sum_comp // total)
        return {
            "total_claims": int(total),
            "avg_compliance_pct": int(avg_comp),
        }

    @gl.public.view
    def get_pool_stats(self, pool_id: str) -> dict:
        return {
            "total_claims": int(self.pool_total_claims.get(pool_id, bigint(0))),
            "total_payouts": str(self.pool_total_payouts.get(pool_id, bigint(0))),
        }
