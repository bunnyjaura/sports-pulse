/**
 * Target Isolation Auditor (Step 29)
 * Enforces strict pre-kickoff temporal isolation: match.kickoffAtMs < target.kickoffAtMs.
 * Validates that zero target match scores, results, or future matches are used.
 */

export function auditTargetIsolation(targetMatch, trainingMatches = []) {
  if (!targetMatch) {
    return {
      temporalIntegrity: 'FAIL',
      reason: 'No target match provided for isolation audit.'
    };
  }

  const targetMs = targetMatch.kickoffAtMs || new Date(targetMatch.kickoffAt || targetMatch.date).getTime();
  const targetId = targetMatch.id;

  let futureMatchesUsed = 0;
  let targetMatchUsed = false;
  let postKickoffEvidenceUsed = 0;

  for (const m of trainingMatches) {
    if (targetId && (m.id === targetId || m.matchId === targetId)) {
      targetMatchUsed = true;
    }
    const mMs = m.kickoffAtMs || new Date(m.kickoffAt || m.date).getTime();
    if (mMs >= targetMs) {
      futureMatchesUsed++;
      postKickoffEvidenceUsed++;
    }
  }

  const isPassed = !targetMatchUsed && futureMatchesUsed === 0;

  return {
    temporalIntegrity: isPassed ? 'PASS' : 'FAIL',
    targetMatchId: targetId,
    targetKickoffMs: targetMs,
    evaluatedTrainingCount: trainingMatches.length,
    targetMatchUsed,
    futureMatchesUsed,
    postKickoffEvidenceUsed,
    isPassed
  };
}
