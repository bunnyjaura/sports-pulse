/**
 * Historical State Audit Diagnostic (Step 28)
 * Verifies schema normalization, timestamp parsing, team identity resolution, and temporal isolation.
 */

import { buildPreMatchHistoricalState } from './historicalState';
import { resolveTeamIdentityMatch } from './teamIdentity';

export function auditHistoricalState(targetMatch, allMatches = []) {
  const state = buildPreMatchHistoricalState({ targetMatch, allMatches });

  const homeIdentity = resolveTeamIdentityMatch(targetMatch?.homeTeam, state.teamA);
  const awayIdentity = resolveTeamIdentityMatch(targetMatch?.awayTeam, state.teamB);

  const identityValid = homeIdentity.matched && awayIdentity.matched;

  return {
    targetKickoffAtMs: state.targetKickoffAtMs,
    preMatchCount: state.preMatchMatches.length,
    teamA: state.teamA,
    teamB: state.teamB,
    teamASampleCount: state.teamAHistory.length,
    teamBSampleCount: state.teamBHistory.length,
    directH2HCount: state.directH2HMatches.length,
    latestTeamAEvidenceAtMs: state.latestTeamAEvidenceAtMs,
    latestTeamBEvidenceAtMs: state.latestTeamBEvidenceAtMs,
    identityResolution: identityValid ? 'PASS' : 'FAIL',
    temporalIsolation: state.futureMatchesExcluded ? 'PASS' : 'FAIL',
    homeIdentity,
    awayIdentity
  };
}
