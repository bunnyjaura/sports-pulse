/**
 * Probability Calibrator & Full-Precision Normalizer (Step 21)
 * Ensures probabilities sum strictly to 1.0 while maintaining full float64 precision internally.
 */

export function calibrateProbabilities(rawHome, rawDraw, rawAway) {
  const expH = Math.max(1e-6, rawHome);
  const expD = Math.max(1e-6, rawDraw);
  const expA = Math.max(1e-6, rawAway);
  const sum = expH + expD + expA;

  return {
    home: expH / sum,
    draw: expD / sum,
    away: expA / sum
  };
}
