/**
 * Cold-Start Evidence Quality & Taxonomy Evaluator (Step 27)
 * Establishes strict taxonomy: Team-Specific, Comparative, and Contextual evidence.
 * Enforces authoritative rule: Contextual evidence alone (e.g. League Strength) CANNOT trigger COLD_START.
 * Requires at least 1 valid team-specific factor for prediction eligibility.
 */

export function evaluateColdStartEvidenceQuality(evidenceCategories = {}) {
  const teamSpecificKeys = ['teamStrength', 'recentForm', 'opponentAdjusted', 'homeAway'];
  const comparativeKeys = ['commonOpponents'];
  const contextualKeys = ['leagueStrength'];

  let teamSpecificCount = 0;
  for (const k of teamSpecificKeys) {
    if (evidenceCategories[k]?.available || evidenceCategories[k]?.status === 'AVAILABLE') {
      teamSpecificCount++;
    }
  }

  let comparativeCount = 0;
  for (const k of comparativeKeys) {
    if (evidenceCategories[k]?.available || evidenceCategories[k]?.status === 'AVAILABLE') {
      comparativeCount++;
    }
  }

  let contextualCount = 0;
  for (const k of contextualKeys) {
    if (evidenceCategories[k]?.available || evidenceCategories[k]?.status === 'AVAILABLE') {
      contextualCount++;
    }
  }

  const teamSpecificAvailable = teamSpecificCount > 0;
  const comparativeAvailable = comparativeCount > 0;
  const contextualAvailable = contextualCount > 0;

  const totalMeaningfulCategories = teamSpecificCount + comparativeCount;

  // RULE: If NO team-specific evidence exists -> UNAVAILABLE
  if (!teamSpecificAvailable) {
    return {
      teamSpecificAvailable: false,
      comparativeAvailable,
      contextualAvailable,
      meaningfulCategoryCount: 0,
      evidenceLevel: 'LEVEL_0',
      confidence: 'NONE',
      eligibility: 'UNAVAILABLE',
      reasonCode: 'NO_TEAM_SPECIFIC_PRE_MATCH_EVIDENCE'
    };
  }

  // Determine Evidence Level & Confidence
  let evidenceLevel = 'LEVEL_1';
  let confidence = 'LOW';

  if (totalMeaningfulCategories >= 3) {
    evidenceLevel = 'LEVEL_3';
    confidence = 'HIGH';
  } else if (totalMeaningfulCategories >= 2) {
    evidenceLevel = 'LEVEL_2';
    confidence = 'MODERATE';
  } else {
    evidenceLevel = 'LEVEL_1';
    confidence = 'LOW';
  }

  return {
    teamSpecificAvailable: true,
    comparativeAvailable,
    contextualAvailable,
    meaningfulCategoryCount: totalMeaningfulCategories,
    evidenceLevel,
    confidence,
    eligibility: 'ELIGIBLE',
    reasonCode: 'NONE'
  };
}
