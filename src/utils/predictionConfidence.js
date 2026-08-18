/**
 * Prediction Evidence Confidence Classifier (Step 21)
 * Evaluates evidence quality independently from outcome probability separation.
 */

export function classifyEvidenceQuality(evidenceMap = {}, directCount = 0) {
  if (directCount >= 50) {
    return 'HIGH EVIDENCE';
  } else if (directCount >= 20) {
    return 'MODERATE EVIDENCE';
  } else if (evidenceMap.teamStrength?.status === 'AVAILABLE' && evidenceMap.recentForm?.status === 'AVAILABLE') {
    return 'COLD START EVIDENCE';
  } else if (evidenceMap.teamStrength?.status === 'AVAILABLE') {
    return 'LIMITED EVIDENCE';
  }

  return 'UNAVAILABLE';
}
