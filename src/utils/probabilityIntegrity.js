/**
 * Probability Integrity & Numerically Stable Softmax Normalizer (Step 30)
 * Converts raw outcome scores (S_home, S_draw, S_away) into a mathematically valid probability distribution.
 *
 * Invariants:
 * 1. 0 <= P(home) <= 1, 0 <= P(draw) <= 1, 0 <= P(away) <= 1
 * 2. abs(P(home) + P(draw) + P(away) - 1.0) < 1e-12
 * 3. Zero NaN or Infinity values
 */

export function normalizeOutcomeProbabilities({ homeScore = 0, drawScore = 0, awayScore = 0 }) {
  if ([homeScore, drawScore, awayScore].some(s => typeof s !== 'number' || isNaN(s) || !isFinite(s))) {
    return {
      isValid: false,
      status: 'UNAVAILABLE',
      reasonCode: 'PROBABILITY_NORMALIZATION_FAILED',
      probabilities: null,
      message: 'Raw outcome scores contain invalid NaN or non-finite numbers.'
    };
  }

  // Numerically stable Softmax calculation
  const m = Math.max(homeScore, drawScore, awayScore);
  const eH = Math.exp(homeScore - m);
  const eD = Math.exp(drawScore - m);
  const eA = Math.exp(awayScore - m);

  const sumExp = eH + eD + eA;

  if (sumExp === 0 || !isFinite(sumExp)) {
    return {
      isValid: false,
      status: 'UNAVAILABLE',
      reasonCode: 'PROBABILITY_NORMALIZATION_FAILED',
      probabilities: null,
      message: 'Softmax exponent sum is zero or non-finite.'
    };
  }

  const p_home = eH / sumExp;
  const p_draw = eD / sumExp;
  const p_away = eA / sumExp;

  const probabilities = {
    home: p_home,
    draw: p_draw,
    away: p_away
  };

  const isBounded = [p_home, p_draw, p_away].every(p => typeof p === 'number' && !isNaN(p) && isFinite(p) && p >= 0 && p <= 1);
  const sumProb = p_home + p_draw + p_away;
  const isValidSum = Math.abs(sumProb - 1.0) < 1e-12;

  if (!isBounded || !isValidSum) {
    return {
      isValid: false,
      status: 'UNAVAILABLE',
      reasonCode: 'PROBABILITY_NORMALIZATION_FAILED',
      probabilities: null,
      message: `Probability bounds or sum invariant failed. Sum: ${sumProb}`
    };
  }

  return {
    isValid: true,
    status: 'SUCCESS',
    probabilities,
    sum: sumProb,
    boundsPass: isBounded
  };
}

/**
 * Asserts probability integrity before presenting probabilities to UI or model output.
 * @param {Object} probabilities - { home, draw, away }
 * @returns {boolean}
 */
export function assertProbabilityIntegrity(probabilities) {
  if (!probabilities || typeof probabilities !== 'object') return false;
  const { home, draw, away } = probabilities;
  if ([home, draw, away].some(p => typeof p !== 'number' || isNaN(p) || !isFinite(p) || p < 0 || p > 1)) {
    return false;
  }
  return Math.abs((home + draw + away) - 1.0) < 1e-12;
}
