# v0.2.16
# { "Depends": "py-genlayer:132536jbnxkd1axfxg5rpfr5b60cr11adm2y4r90hgn0l59qsp9w" }
from genlayer import *

def _addr_hex(addr) -> str:
    if hasattr(addr, 'as_hex'):
        return addr.as_hex.lower()
    if isinstance(addr, bytes):
        return "0x" + addr.hex().lower()
    return str(addr).lower()

class Contract(gl.Contract):
    owner: Address
    court_address: Address
    claimant_total_claims: TreeMap[str, bigint]
    claimant_sum_compliance: TreeMap[str, bigint]
    pool_total_claims: TreeMap[str, bigint]
    pool_total_payouts: TreeMap[str, bigint]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.court_address = Address("0x0000000000000000000000000000000000000000")

    @gl.public.write
    def set_court_address(self, court_address: Address) -> None:
        if gl.message.sender_address != self.owner:
            raise UserError("Only owner can set court address")
        self.court_address = court_address

    @gl.public.write
    def record_claim_verdict(self, claimant: Address, pool_id: str, compliance_pct: u256, payout_amount: bigint) -> None:
        if gl.message.sender_address != self.court_address:
            raise UserError("Only court can record claim verdict")
        
        c_key = _addr_hex(claimant)
        
        # Update claimant history
        c_total = self.claimant_total_claims.get(c_key, bigint(0))
        c_sum = self.claimant_sum_compliance.get(c_key, bigint(0))
        self.claimant_total_claims[c_key] = c_total + bigint(1)
        self.claimant_sum_compliance[c_key] = c_sum + bigint(compliance_pct)

        # Update pool history
        p_total = self.pool_total_claims.get(pool_id, bigint(0))
        p_payouts = self.pool_total_payouts.get(pool_id, bigint(0))
        self.pool_total_claims[pool_id] = p_total + bigint(1)
        self.pool_total_payouts[pool_id] = p_payouts + payout_amount

    @gl.public.view
    def get_claimant_reputation(self, claimant: Address) -> dict:
        c_key = _addr_hex(claimant)
        total = self.claimant_total_claims.get(c_key, bigint(0))
        sum_comp = self.claimant_sum_compliance.get(c_key, bigint(0))
        avg_comp = bigint(0) if total == bigint(0) else (sum_comp // total)
        return {
            "total_claims": total,
            "avg_compliance_pct": avg_comp
        }

    @gl.public.view
    def get_pool_stats(self, pool_id: str) -> dict:
        total_claims = self.pool_total_claims.get(pool_id, bigint(0))
        total_payouts = self.pool_total_payouts.get(pool_id, bigint(0))
        return {
            "total_claims": total_claims,
            "total_payouts": total_payouts
        }
