/**
 * Cold-Start Feature Semantics Auditor (Step 29)
 * Verifies feature values represent pre-kickoff evidence without future/post-kickoff data leakage.
 */

export function auditFeatureSemantics(historicalState, targetMatch) {
  if (!historicalState || !targetMatch) {
    return {
      isSemanticsValid: false,
      errors: ['Missing historical state or target match for semantics audit.']
    };
  }

  const errors = [];
  const targetMs = targetMatch.kickoffAtMs || new Date(targetMatch.kickoffAt || targetMatch.date).getTime();

  // 1. Team Strength
  if (historicalState.homeHistory?.some(m => m.kickoffAtMs >= targetMs)) {
    errors.push('Home team strength contains future matches.');
  }

  // 2. Recent Form
  if (historicalState.homeForm5?.some(m => m.kickoffAtMs >= targetMs)) {
    errors.push('Recent form contains future matches.');
  }

  // 3. Home/Away Split
  if (historicalState.homeTeamHomeMatches?.some(m => m.kickoffAtMs >= targetMs)) {
    errors.push('Home/away split contains future matches.');
  }

  // 4. Opponent Adjusted Strength
  if (historicalState.opponentAdjustedMatches?.some(m => m.kickoffAtMs >= targetMs)) {
    errors.push('Opponent-adjusted strength contains future matches.');
  }

  // 5. Common Opponents
  if (historicalState.commonOpponentsMatches?.some(m => m.kickoffAtMs >= targetMs)) {
    errors.push('Common opponents contains future matches.');
  }

  return {
    isSemanticsValid: errors.length === 0,
    errors,
    semanticStatus: errors.length === 0 ? 'PASS' : 'FAIL'
  };
}
