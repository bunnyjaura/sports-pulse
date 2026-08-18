/**
 * Centralized Cold-Start Weight Contract (Step 29)
 * Single authoritative source of truth for production cold-start feature weights.
 * Canonical Contract Version: step29-v1
 */

export const COLDSTART_WEIGHT_CONTRACT = Object.freeze({
  version: 'step29-v1',
  weights: Object.freeze({
    teamStrength: 0.31,
    recentForm: 0.22,
    opponentAdjusted: 0.16,
    homeAway: 0.12,
    commonOpponents: 0.11,
    leagueStrength: 0.08,
    playerStrength: 0.00
  })
});

/**
 * Validates weight contract invariants:
 * 1. Every weight >= 0
 * 2. Sum of configured weights === 1.0 ± 1e-12
 * @returns {{ isValid: boolean, sum: number, errors: string[] }}
 */
export function validateWeightContract(contract = COLDSTART_WEIGHT_CONTRACT) {
  const errors = [];
  let sum = 0;

  for (const [feature, weight] of Object.entries(contract.weights)) {
    if (typeof weight !== 'number' || isNaN(weight)) {
      errors.push(`Invalid weight type for feature '${feature}': ${weight}`);
    } else if (weight < 0) {
      errors.push(`Negative weight for feature '${feature}': ${weight}`);
    } else {
      sum += weight;
    }
  }

  if (Math.abs(sum - 1.0) > 1e-12) {
    errors.push(`Configured weights do not sum to 1.0 ± 1e-12. Actual sum: ${sum}`);
  }

  return {
    isValid: errors.length === 0,
    sum,
    errors
  };
}

/**
 * Dynamically calculates effective weights for available evidence categories.
 * Formula: effectiveWeight_i = configuredWeight_i / sum(configuredWeight_k for available k)
 * Invariant: Unavailable categories remain effectiveWeight = 0.
 * Invariant: abs(sum(effectiveWeights) - 1.0) < 1e-12 (when at least 1 feature is available).
 *
 * @param {Record<string, boolean>} availableMap - Map of feature key -> boolean availability
 * @param {Object} contract - ColdStart Weight Contract
 * @returns {{ effectiveWeights: Record<string, number>, availableSum: number, isValidSum: boolean }}
 */
export function calculateEffectiveWeights(availableMap = {}, contract = COLDSTART_WEIGHT_CONTRACT) {
  let availableSum = 0;

  for (const [feature, weight] of Object.entries(contract.weights)) {
    if (availableMap[feature] === true && weight > 0) {
      availableSum += weight;
    }
  }

  const effectiveWeights = {};
  let effectiveSum = 0;

  for (const [feature, weight] of Object.entries(contract.weights)) {
    if (availableMap[feature] === true && weight > 0 && availableSum > 0) {
      const eff = weight / availableSum;
      effectiveWeights[feature] = eff;
      effectiveSum += eff;
    } else {
      effectiveWeights[feature] = 0;
    }
  }

  const isValidSum = availableSum === 0 || Math.abs(effectiveSum - 1.0) < 1e-12;

  return {
    effectiveWeights,
    availableSum,
    effectiveSum,
    isValidSum
  };
}
