/**
 * Dataset Eligibility Utility for Past Match Audit (Step 26)
 * Determines whether a historical match target is eligible for audit evaluation.
 * Authoritative condition: preMatchCount > 0 via canonical preMatchFilter.js.
 */

import { getPreMatchMatches } from './preMatchFilter';
import { normalizeKickoffDate } from './dateNormalizer';

export function evaluatePastMatchEligibility(targetMatch = null, allMatches = []) {
  if (!targetMatch) {
    return {
      eligible: false,
      status: 'EXCLUDED',
      reasonCode: 'INVALID_TIMESTAMP',
      targetKickoffAtMs: 0,
      datasetEarliestKickoffAtMs: 0,
      preMatchCount: 0,
      metadata: { hasPreMatchData: false, datasetCoverageAvailable: false }
    };
  }

  const targetDateNorm = normalizeKickoffDate(targetMatch.kickoffAt || targetMatch.date);
  if (!targetDateNorm.isValid) {
    return {
      eligible: false,
      status: 'EXCLUDED',
      reasonCode: 'INVALID_TIMESTAMP',
      targetKickoffAtMs: 0,
      datasetEarliestKickoffAtMs: 0,
      preMatchCount: 0,
      metadata: { hasPreMatchData: false, datasetCoverageAvailable: false }
    };
  }

  const targetKickoffAtMs = targetDateNorm.timestampMs;

  // Find dataset earliest kickoff timestamp
  let datasetEarliestKickoffAtMs = Infinity;
  for (const m of allMatches) {
    const mNorm = normalizeKickoffDate(m.kickoffAt || m.date);
    if (mNorm.isValid && mNorm.timestampMs < datasetEarliestKickoffAtMs) {
      datasetEarliestKickoffAtMs = mNorm.timestampMs;
    }
  }

  if (datasetEarliestKickoffAtMs === Infinity) {
    datasetEarliestKickoffAtMs = 0;
  }

  // Canonical pre-match filter check (t < T)
  const preMatchMatches = getPreMatchMatches(allMatches, targetMatch, targetDateNorm.isoString);
  const preMatchCount = preMatchMatches.length;

  if (targetKickoffAtMs < datasetEarliestKickoffAtMs) {
    return {
      eligible: false,
      status: 'EXCLUDED',
      reasonCode: 'BEFORE_DATASET_START',
      targetKickoffAtMs,
      datasetEarliestKickoffAtMs,
      preMatchCount: 0,
      metadata: { hasPreMatchData: false, datasetCoverageAvailable: true }
    };
  }

  if (preMatchCount === 0) {
    return {
      eligible: false,
      status: 'EXCLUDED',
      reasonCode: 'NO_PRE_MATCH_DATA',
      targetKickoffAtMs,
      datasetEarliestKickoffAtMs,
      preMatchCount: 0,
      metadata: { hasPreMatchData: false, datasetCoverageAvailable: true }
    };
  }

  return {
    eligible: true,
    status: 'ELIGIBLE',
    reasonCode: null,
    targetKickoffAtMs,
    datasetEarliestKickoffAtMs,
    preMatchCount,
    metadata: { hasPreMatchData: true, datasetCoverageAvailable: true }
  };
}
