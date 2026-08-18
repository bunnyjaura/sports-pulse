/**
 * Learned Evidence Weight Engine & Dynamic Renormalizer (Step 22)
 * Exports optimal evidence weights learned from Step 22 chronological validation.
 * Performs dynamic missing-evidence weight renormalization.
 */

export const OPTIMAL_COLDSTART_WEIGHTS = {
  teamStrength: 0.31,
  recentForm: 0.22,
  opponentStrength: 0.16,
  commonOpponents: 0.11,
  homeAway: 0.12,
  leagueStrength: 0.08,
  playerStrength: 0.00
};

/**
 * Renormalizes weights when any evidence category is UNAVAILABLE.
 * @param {Array<string>} availableKeys 
 * @returns {Object<string, number>}
 */
export function renormalizeAvailableWeights(availableKeys = []) {
  let total = 0;
  for (const k of availableKeys) {
    total += (OPTIMAL_COLDSTART_WEIGHTS[k] || 0);
  }

  if (total <= 0) {
    return { ...OPTIMAL_COLDSTART_WEIGHTS };
  }

  const renormalized = {};
  for (const k of availableKeys) {
    if (OPTIMAL_COLDSTART_WEIGHTS[k] !== undefined) {
      renormalized[k] = OPTIMAL_COLDSTART_WEIGHTS[k] / total;
    }
  }

  return renormalized;
}
