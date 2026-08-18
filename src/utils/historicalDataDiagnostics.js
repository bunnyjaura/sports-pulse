/**
 * Historical Data Pipeline Diagnostics (Step 20)
 * Traces dataset loading, dates, league/season filtering, and target cutoff stage match counts.
 */

import { normalizeKickoffDate, isStrictlyBefore } from './dateNormalizer';
import { normalizeTeamName } from './teamNormalizer';

/**
 * Generates summary diagnostics for full historical dataset.
 * @param {Array} matches 
 */
export function getHistoricalDatasetDiagnostics(matches = []) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return {
      totalMatches: 0,
      validKickoffCount: 0,
      invalidKickoffCount: 0,
      earliestMatch: null,
      latestMatch: null,
      leagues: [],
      seasons: [],
      matchesByLeague: {},
      matchesBySeason: {},
      uniqueTeams: 0
    };
  }

  let validCount = 0;
  let invalidCount = 0;
  let minMs = Infinity;
  let maxMs = -Infinity;

  const matchesByLeague = {};
  const matchesBySeason = {};
  const teamsSet = new Set();

  for (const m of matches) {
    const normDate = normalizeKickoffDate(m.kickoffAt || m.date);
    if (normDate.isValid) {
      validCount++;
      if (normDate.timestampMs < minMs) minMs = normDate.timestampMs;
      if (normDate.timestampMs > maxMs) maxMs = normDate.timestampMs;
    } else {
      invalidCount++;
    }

    const lg = m.league || m.leagueName || 'Premier League';
    const s = m.season || '2024-25';
    const h = normalizeTeamName(m.homeTeam);
    const a = normalizeTeamName(m.awayTeam);

    if (h) teamsSet.add(h);
    if (a) teamsSet.add(a);

    matchesByLeague[lg] = (matchesByLeague[lg] || 0) + 1;
    matchesBySeason[s] = (matchesBySeason[s] || 0) + 1;
  }

  return {
    totalMatches: matches.length,
    validKickoffCount: validCount,
    invalidKickoffCount: invalidCount,
    earliestMatch: minMs !== Infinity ? new Date(minMs).toISOString().split('T')[0] : null,
    latestMatch: maxMs !== -Infinity ? new Date(maxMs).toISOString().split('T')[0] : null,
    leagues: Object.keys(matchesByLeague).sort(),
    seasons: Object.keys(matchesBySeason).sort().reverse(),
    matchesByLeague,
    matchesBySeason,
    uniqueTeams: teamsSet.size
  };
}

/**
 * Traces exact pre-match cutoff filtering stages for a target fixture.
 * @param {Array} matches 
 * @param {Object} targetMatch 
 */
export function getPreMatchDiagnostics(matches = [], targetMatch = null) {
  if (!targetMatch) {
    return {
      status: 'INVALID_TARGET',
      finalTrainingCount: 0,
      minimumRequired: 50,
      reason: 'No target match provided'
    };
  }

  const targetDateNorm = normalizeKickoffDate(targetMatch.kickoffAt || targetMatch.date);
  if (!targetDateNorm.isValid) {
    return {
      status: 'INVALID_TARGET',
      finalTrainingCount: 0,
      minimumRequired: 50,
      reason: 'Target match has invalid kickoff date'
    };
  }

  const datasetTotal = matches.length;
  const targetId = targetMatch.id;
  const targetKickoffMs = targetDateNorm.timestampMs;
  const targetLeague = targetMatch.league || targetMatch.leagueName || 'Premier League';
  const targetSeason = targetMatch.season || '2024-25';

  let matchesBeforeCutoff = 0;
  let matchesAtOrAfterCutoff = 0;

  let sameLeagueMatches = 0;
  let sameSeasonMatches = 0;
  let previousSeasonMatches = 0;

  let sameLeagueBeforeCutoff = 0;
  let sameSeasonBeforeKickoff = 0;

  let targetIncluded = false;
  let futureMatchesIncluded = false;

  let earliestPriorMs = Infinity;
  let latestPriorMs = -Infinity;

  for (const m of matches) {
    const isTarget = targetId && m.id === targetId;
    const mDateNorm = normalizeKickoffDate(m.kickoffAt || m.date);
    if (!mDateNorm.isValid) continue;

    const mLg = m.league || m.leagueName || 'Premier League';
    const mSeason = m.season || '2024-25';

    if (mLg === targetLeague) sameLeagueMatches++;
    if (mSeason === targetSeason) sameSeasonMatches++;
    else previousSeasonMatches++;

    if (mDateNorm.timestampMs < targetKickoffMs) {
      if (isTarget) targetIncluded = true;

      matchesBeforeCutoff++;
      if (mLg === targetLeague) sameLeagueBeforeCutoff++;
      if (mSeason === targetSeason) sameSeasonBeforeKickoff++;

      if (mDateNorm.timestampMs < earliestPriorMs) earliestPriorMs = mDateNorm.timestampMs;
      if (mDateNorm.timestampMs > latestPriorMs) latestPriorMs = mDateNorm.timestampMs;
    } else {
      matchesAtOrAfterCutoff++;
      if (!isTarget && mDateNorm.timestampMs > targetKickoffMs) {
        futureMatchesIncluded = false; // In training list check
      }
    }
  }

  const finalTrainingCount = matchesBeforeCutoff;

  let status = 'FULL_HISTORY';
  if (finalTrainingCount < 50) {
    status = 'INSUFFICIENT_HISTORY';
  } else if (finalTrainingCount < 200) {
    status = 'LIMITED_HISTORY';
  } else if (finalTrainingCount < 500) {
    status = 'MODERATE_HISTORY';
  }

  return {
    targetMatchId: targetId,
    targetHome: normalizeTeamName(targetMatch.homeTeam),
    targetAway: normalizeTeamName(targetMatch.awayTeam),
    targetLeague,
    targetSeason,
    targetKickoff: targetDateNorm.isoString,

    datasetTotal,
    matchesBeforeCutoff,
    matchesAtOrAfterCutoff,

    sameLeagueMatches,
    sameSeasonMatches,
    previousSeasonMatches,

    sameLeagueBeforeCutoff,
    sameSeasonBeforeKickoff,

    earliestPriorMatch: earliestPriorMs !== Infinity ? new Date(earliestPriorMs).toISOString().split('T')[0] : null,
    latestPriorMatch: latestPriorMs !== -Infinity ? new Date(latestPriorMs).toISOString().split('T')[0] : null,

    targetIncluded,
    futureMatchesIncluded: false,

    finalTrainingCount,
    minimumRequired: 50,
    status
  };
}
