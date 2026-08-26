# v0.2.16
# { "Depends": "py-genlayer:132536jbnxkd1axfxg5rpfr5b60cr11adm2y4r90hgn0l59qsp9w" }
from genlayer import *

class Contract(gl.Contract):
    owner: Address
    court_address: Address
    pool_balances: TreeMap[str, bigint]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.court_address = Address("0x0000000000000000000000000000000000000000")

    @gl.public.write
    def set_court_address(self, court_address: Address) -> None:
        if gl.message.sender_address != self.owner:
            raise UserError("Only owner can set court address")
        self.court_address = court_address

    @gl.public.write
    def deposit_to_pool(self, pool_id: str) -> None:
        deposit_amount = bigint(gl.message.value)
        if deposit_amount == 0:
            raise UserError("Deposit amount must be greater than 0")
        current_bal = self.pool_balances.get(pool_id, bigint(0))
        self.pool_balances[pool_id] = current_bal + deposit_amount

    @gl.public.write
    def payout(self, pool_id: str, recipient: Address, amount: bigint) -> None:
        if gl.message.sender_address != self.court_address:
            raise UserError("Only court can trigger payout")
        
        current_bal = self.pool_balances.get(pool_id, bigint(0))
        if current_bal < amount:
            raise UserError("Insufficient pool balance in treasury")
        
        self.pool_balances[pool_id] = current_bal - amount
        gl.get_contract_at(recipient).emit_transfer(value=u256(amount))

    @gl.public.write
    def refund_pool(self, pool_id: str, recipient: Address, amount: bigint) -> None:
        if gl.message.sender_address != self.court_address and gl.message.sender_address != self.owner:
            raise UserError("Only court or owner can refund pool")
        
        current_bal = self.pool_balances.get(pool_id, bigint(0))
        if current_bal < amount:
            raise UserError("Insufficient pool balance in treasury")
        
        self.pool_balances[pool_id] = current_bal - amount
        gl.get_contract_at(recipient).emit_transfer(value=u256(amount))

    @gl.public.view
    def get_pool_balance(self, pool_id: str) -> bigint:
        return self.pool_balances.get(pool_id, bigint(0))
