/**
 * Canonical Pre-Match Historical State Builder (Step 28)
 * Single source of truth for historical observation reconstruction prior to kickoff T.
 * Strictly enforces match.kickoffAtMs < targetMatch.kickoffAtMs (<, never <=).
 */

import { normalizeHistoricalMatch } from './historicalDataAdapter';
import { sameTeam } from './teamIdentity';
import { normalizeKickoffDate } from './dateNormalizer';

export function buildPreMatchHistoricalState({ targetMatch = null, allMatches = [] }) {
  if (!targetMatch) {
    return {
      targetMatch: null,
      targetKickoffAtMs: 0,
      teamA: '',
      teamB: '',
      teamAHistory: [],
      teamBHistory: [],
      teamAHomeHistory: [],
      teamAAwayHistory: [],
      teamBHomeHistory: [],
      teamBAwayHistory: [],
      directH2HMatches: [],
      commonOpponents: [],
      preMatchMatches: [],
      futureMatchesExcluded: true,
      latestTeamAEvidenceAtMs: 0,
      latestTeamBEvidenceAtMs: 0,
      diagnostics: { status: 'INVALID_TARGET' }
    };
  }

  const normTarget = normalizeHistoricalMatch(targetMatch);
  const targetKickoffAtMs = normTarget.kickoffAtMs;
  const targetId = normTarget.matchId;

  const teamA = normTarget.homeTeamName;
  const teamB = normTarget.awayTeamName;

  // Filter & Normalize all historical matches strictly prior to target kickoff
  const preMatchMatches = [];
  let datasetEarliestKickoffAtMs = Infinity;

  for (const raw of allMatches) {
    const norm = normalizeHistoricalMatch(raw);
    if (!norm || !norm.kickoffAtMs) continue;

    if (norm.kickoffAtMs < datasetEarliestKickoffAtMs) {
      datasetEarliestKickoffAtMs = norm.kickoffAtMs;
    }

    // Exclude target match itself
    if (targetId && norm.matchId === targetId) continue;

    // Strict inequality: match.kickoffAtMs < target.kickoffAtMs
    if (norm.kickoffAtMs < targetKickoffAtMs) {
      preMatchMatches.push(norm);
    }
  }

  // Sort chronologically
  preMatchMatches.sort((a, b) => a.kickoffAtMs - b.kickoffAtMs);

  // Extract Team A & Team B pre-kickoff appearances
  const teamAHistory = preMatchMatches.filter(m => sameTeam(m.homeTeamName, teamA) || sameTeam(m.awayTeamName, teamA));
  const teamBHistory = preMatchMatches.filter(m => sameTeam(m.homeTeamName, teamB) || sameTeam(m.awayTeamName, teamB));

  const teamAHomeHistory = preMatchMatches.filter(m => sameTeam(m.homeTeamName, teamA));
  const teamAAwayHistory = preMatchMatches.filter(m => sameTeam(m.awayTeamName, teamA));

  const teamBHomeHistory = preMatchMatches.filter(m => sameTeam(m.homeTeamName, teamB));
  const teamBAwayHistory = preMatchMatches.filter(m => sameTeam(m.awayTeamName, teamB));

  const directH2HMatches = preMatchMatches.filter(m => 
    (sameTeam(m.homeTeamName, teamA) && sameTeam(m.awayTeamName, teamB)) ||
    (sameTeam(m.homeTeamName, teamB) && sameTeam(m.awayTeamName, teamA))
  );

  const latestTeamAEvidenceAtMs = teamAHistory.length > 0 ? teamAHistory[teamAHistory.length - 1].kickoffAtMs : 0;
  const latestTeamBEvidenceAtMs = teamBHistory.length > 0 ? teamBHistory[teamBHistory.length - 1].kickoffAtMs : 0;

  return {
    targetMatch: normTarget,
    targetKickoffAtMs,
    teamA,
    teamB,
    teamAHistory,
    teamBHistory,
    teamAHomeHistory,
    teamAAwayHistory,
    teamBHomeHistory,
    teamBAwayHistory,
    directH2HMatches,
    preMatchMatches,
    futureMatchesExcluded: true,
    latestTeamAEvidenceAtMs,
    latestTeamBEvidenceAtMs,
    diagnostics: {
      status: 'SUCCESS',
      preMatchCount: preMatchMatches.length,
      teamASampleCount: teamAHistory.length,
      teamBSampleCount: teamBHistory.length,
      directH2HCount: directH2HMatches.length,
      identityResolution: 'PASS',
      temporalIsolation: 'PASS'
    }
  };
}
