/**
 * Cold-Start Feature Connectivity Auditor (Step 29 - Step 30)
 * Executes controlled perturbation testing for active features to verify that
 * configured & available features structurally & perturbationally affect model probability outputs.
 */

import { COLDSTART_WEIGHT_CONTRACT } from './coldStartWeightContract';

export function auditFeatureConnectivity(predictFn, baseState, contract = COLDSTART_WEIGHT_CONTRACT) {
  if (!predictFn || typeof predictFn !== 'function') {
    throw new Error('Connectivity audit requires a valid prediction function.');
  }

  const baseResult = predictFn(baseState);
  if (!baseResult || !baseResult.probabilities) {
    return {
      isAudited: false,
      reason: 'Base prediction returned null probabilities (UNAVAILABLE).',
      features: {}
    };
  }

  const baseP = baseResult.probabilities;
  const auditResults = {};
  let connectedCount = 0;
  let totalActive = 0;

  const availableMap = baseResult.availableMap || baseResult.evidenceAvailability?.categories || baseResult.featureProvenance || {};

  for (const [featureKey, configuredWeight] of Object.entries(contract.weights)) {
    const isAvailable = availableMap[featureKey] === true || availableMap[featureKey]?.available === true;
    const effectiveWeight = baseResult.effectiveWeights?.[featureKey] || (isAvailable ? configuredWeight : 0);

    if (configuredWeight === 0) {
      auditResults[featureKey] = {
        feature: featureKey,
        configuredWeight: 0,
        available: false,
        effectiveWeight: 0,
        deltaHome: 0,
        deltaDraw: 0,
        deltaAway: 0,
        deltaTotal: 0,
        status: 'NOT_CONFIGURED'
      };
      continue;
    }

    if (!isAvailable) {
      auditResults[featureKey] = {
        feature: featureKey,
        configuredWeight,
        available: false,
        effectiveWeight: 0,
        deltaHome: 0,
        deltaDraw: 0,
        deltaAway: 0,
        deltaTotal: 0,
        status: 'UNAVAILABLE'
      };
      continue;
    }

    totalActive++;

    // Controlled perturbation
    const perturbedState = JSON.parse(JSON.stringify(baseState));
    if (!perturbedState.perturbedFeatureValues) {
      perturbedState.perturbedFeatureValues = {};
    }
    perturbedState.perturbedFeatureValues[featureKey] = 0.85; // Perturbation

    const perturbedResult = predictFn(perturbedState);
    if (!perturbedResult || !perturbedResult.probabilities) {
      auditResults[featureKey] = {
        feature: featureKey,
        configuredWeight,
        available: true,
        effectiveWeight,
        deltaHome: 0,
        deltaDraw: 0,
        deltaAway: 0,
        deltaTotal: 0,
        status: 'FEATURE_NOT_CONNECTED'
      };
      continue;
    }

    const pP = perturbedResult.probabilities;
    const dHome = Math.abs(pP.home - baseP.home);
    const dDraw = Math.abs(pP.draw - baseP.draw);
    const dAway = Math.abs(pP.away - baseP.away);
    const dTotal = dHome + dDraw + dAway;

    const isConnected = dTotal > 1e-4 || (baseResult.featureContributions?.[featureKey]?.structurallyConnected === true);
    if (isConnected) connectedCount++;

    auditResults[featureKey] = {
      feature: featureKey,
      configuredWeight,
      available: true,
      effectiveWeight,
      deltaHome: dHome,
      deltaDraw: dDraw,
      deltaAway: dAway,
      deltaTotal: dTotal,
      status: isConnected ? 'CONNECTED' : 'FEATURE_PERTURBATION_INSENSITIVE'
    };
  }

  return {
    isAudited: true,
    allActiveConnected: totalActive > 0 && connectedCount === totalActive,
    connectedCount,
    totalActive,
    features: auditResults
  };
}
