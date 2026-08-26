# Archived — pre-consolidation 3-contract architecture

These files are **not deployed** and are kept only as historical reference.

| File | Former role |
| --- | --- |
| `claim_court.py` | Claim registry + AI verdict (called treasury + reputation) |
| `treasury.py` | Pool escrow / payouts |
| `reputation.py` | Claimant compliance history |

The live source of truth is `contracts/claim_verdict.py`. That consolidated contract includes `retry_resolution` and the Point 2/3 escrow reservation + payable-branch consensus fixes that these archived files do not have.
