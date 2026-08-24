// deprecatedPools.js
// Explicit list of legacy pool IDs deployed before the base-unit convention update.
// No heuristic guessing is performed; deprecated pools are tracked strictly by explicit ID.

export const DEPRECATED_POOL_IDS = new Set([
  "0",
  "1"
]);

export const isDeprecatedPool = (poolId) => {
  if (poolId === null || poolId === undefined) return false;
  return DEPRECATED_POOL_IDS.has(String(poolId).trim());
};
