/**
 * Centralized Evidence Availability & Threshold Evaluator (Step 23 & Step 29)
 * Distinguishes Direct H2H History from Broader Team History & League Context.
 * Evaluates sample size thresholds, availability status, configured weights, and effective normalized weights.
 * Consumes single authoritative weight contract: COLDSTART_WEIGHT_CONTRACT (step29-v1).
 */

import { COLDSTART_WEIGHT_CONTRACT, calculateEffectiveWeights } from './coldStartWeightContract';

export const EVIDENCE_THRESHOLDS = {
  teamStrength: 1,
  recentForm: 3,
  opponentAdjusted: 3,
  homeAway: 3,
  commonOpponents: 1,
  leagueStrength: 10,
  playerStrength: 1
};

export function evaluateEvidenceAvailability({
  directH2HCount = 0,
  teamAHistoryCount = 0,
  teamBHistoryCount = 0,
  recentFormCountA = 0,
  recentFormCountB = 0,
  oppAdjustedCountA = 0,
  oppAdjustedCountB = 0,
  homeAwayCountA = 0,
  homeAwayCountB = 0,
  commonOpponentsCount = 0,
  leagueMatchesCount = 0,
  playerDataAvailable = false
}) {
  const statusMap = {
    teamStrength: (teamAHistoryCount >= EVIDENCE_THRESHOLDS.teamStrength || teamBHistoryCount >= EVIDENCE_THRESHOLDS.teamStrength),
    recentForm: (recentFormCountA >= EVIDENCE_THRESHOLDS.recentForm || recentFormCountB >= EVIDENCE_THRESHOLDS.recentForm),
    opponentAdjusted: (oppAdjustedCountA >= EVIDENCE_THRESHOLDS.opponentAdjusted || oppAdjustedCountB >= EVIDENCE_THRESHOLDS.opponentAdjusted),
    homeAway: (homeAwayCountA >= EVIDENCE_THRESHOLDS.homeAway || homeAwayCountB >= EVIDENCE_THRESHOLDS.homeAway),
    commonOpponents: commonOpponentsCount >= EVIDENCE_THRESHOLDS.commonOpponents,
    leagueStrength: leagueMatchesCount >= EVIDENCE_THRESHOLDS.leagueStrength,
    playerStrength: playerDataAvailable
  };

  const sampleSizes = {
    teamStrength: `${teamAHistoryCount} / ${teamBHistoryCount}`,
    recentForm: `${recentFormCountA} / ${recentFormCountB}`,
    opponentAdjusted: `${oppAdjustedCountA} / ${oppAdjustedCountB}`,
    homeAway: `${homeAwayCountA} / ${homeAwayCountB}`,
    commonOpponents: commonOpponentsCount,
    leagueStrength: leagueMatchesCount,
    playerStrength: playerDataAvailable ? 1 : 0
  };

  // Determine effective normalized weights using authoritative contract
  const { effectiveWeights, availableSum, isValidSum } = calculateEffectiveWeights(statusMap, COLDSTART_WEIGHT_CONTRACT);

  const availableKeys = Object.keys(statusMap).filter(k => statusMap[k]);
  const hasBroaderEvidence = availableKeys.length > 0;

  const result = {
    directH2H: {
      samples: directH2HCount,
      available: directH2HCount >= 50
    }
  };

  for (const key of Object.keys(EVIDENCE_THRESHOLDS)) {
    const isAvail = !!statusMap[key];
    const cfgWeight = COLDSTART_WEIGHT_CONTRACT.weights[key] || 0;
    const effWeight = effectiveWeights[key] || 0;

    result[key] = {
      samples: sampleSizes[key],
      available: isAvail,
      configuredWeight: cfgWeight,
      effectiveWeight: effWeight
    };
  }

  return {
    contractVersion: COLDSTART_WEIGHT_CONTRACT.version,
    categories: result,
    hasBroaderEvidence,
    availableKeys,
    availableSum,
    isValidSum,
    directH2HCount
  };
}
