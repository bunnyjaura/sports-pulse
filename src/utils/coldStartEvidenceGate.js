/**
 * Cold-Start Evidence Gate (Step 29)
 * Enforces per-team pre-kickoff evidence requirement.
 * Rule: Both Team A AND Team B must have meaningful team-specific historical evidence.
 */

export function evaluateBothTeamEvidenceGate({ homeHistoryCount = 0, awayHistoryCount = 0, teamAAvailable = false, teamBAvailable = false }) {
  const teamSpecificAvailable = (homeHistoryCount > 0 || teamAAvailable) && (awayHistoryCount > 0 || teamBAvailable);

  if (!teamSpecificAvailable) {
    return {
      passed: false,
      eligible: false,
      status: 'UNAVAILABLE',
      reasonCode: 'NO_TEAM_SPECIFIC_PRE_MATCH_EVIDENCE',
      probabilities: null,
      confidence: 'NONE',
      message: 'One or both teams lack pre-match team-specific historical observations.'
    };
  }

  return {
    passed: true,
    eligible: true,
    status: 'ELIGIBLE',
    confidence: 'MODERATE',
    reasonCode: 'BOTH_TEAMS_EVIDENCE_AVAILABLE',
    message: 'Both teams possess valid pre-kickoff historical observations.'
  };
}

export function evaluateColdStartEvidence(categories = {}, preMatchMatchesCount = 0) {
  const teamAHistoryCount = categories.teamStrength?.samples || 0;
  const teamBHistoryCount = categories.teamStrength?.samples || 0;
  const teamAAvailable = categories.teamStrength?.available || false;
  const teamBAvailable = categories.teamStrength?.available || false;

  return evaluateBothTeamEvidenceGate({
    homeHistoryCount: teamAHistoryCount,
    awayHistoryCount: teamBHistoryCount,
    teamAAvailable,
    teamBAvailable
  });
}
