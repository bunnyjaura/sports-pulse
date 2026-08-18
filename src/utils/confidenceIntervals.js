/**
 * Statistical Confidence Intervals Utility
 * Computes 95% Wilson Score and Normal approximation Confidence Intervals for proportions.
 */

/**
 * Calculates 95% Wilson Score Confidence Interval for a proportion p = correct / N.
 * Wilson Score interval performs robustly even for small sample sizes or extreme proportions.
 * 
 * @param {number} correctCount - Number of successful outcomes
 * @param {number} totalCount - Total sample size (N)
 * @param {number} [confidenceLevel=0.95] - Confidence level (default 0.95 -> z = 1.96)
 * @returns {Object} { proportion, lowerBound, upperBound, ciText, marginOfError }
 */
export function calculateWilsonConfidenceInterval(correctCount, totalCount, confidenceLevel = 0.95) {
  if (!totalCount || totalCount <= 0) {
    return {
      proportion: 0,
      lowerBound: 0,
      upperBound: 0,
      ciText: '0.0% – 0.0%',
      marginOfError: 0
    };
  }

  const p = Math.max(0, Math.min(1.0, correctCount / totalCount));
  const n = totalCount;
  const z = 1.96; // 95% confidence z-score

  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const spread = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denominator;

  const lowerBound = Math.max(0, center - spread);
  const upperBound = Math.min(1.0, center + spread);
  const marginOfError = (upperBound - lowerBound) / 2;

  const pPct = (p * 100).toFixed(1);
  const lowerPct = (lowerBound * 100).toFixed(1);
  const upperPct = (upperBound * 100).toFixed(1);

  return {
    proportion: p,
    lowerBound,
    upperBound,
    marginOfError,
    ciText: `${lowerPct}% – ${upperPct}%`,
    fullDisplay: `${pPct}% (95% CI: ${lowerPct}% – ${upperPct}%, N = ${n})`
  };
}

/**
 * Computes Expected Calibration Error (ECE) for probability predictions.
 */
export function computeECE(predictions, numBins = 10) {
  if (!predictions || predictions.length === 0) return 0.0;

  const binBoundaries = Array.from({ length: numBins + 1 }, (_, i) => i / numBins);
  let totalECE = 0.0;
  const N = predictions.length;

  for (let i = 0; i < numBins; i++) {
    const binLower = binBoundaries[i];
    const binUpper = binBoundaries[i + 1];

    const inBin = predictions.filter(p => p.confidence > binLower && p.confidence <= binUpper);
    if (inBin.length > 0) {
      const avgAccuracy = inBin.filter(p => p.isCorrect).length / inBin.length;
      const avgConfidence = inBin.reduce((sum, p) => sum + p.confidence, 0) / inBin.length;
      totalECE += Math.abs(avgAccuracy - avgConfidence) * (inBin.length / N);
    }
  }

  return parseFloat(totalECE.toFixed(4));
}
