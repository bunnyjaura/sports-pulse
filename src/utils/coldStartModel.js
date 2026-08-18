/**
 * Cold-Start Prediction Engine (Step 28 - Step 30)
 * Delegates cold-start match predictions to the canonical coldStartPredictionPipeline.js module.
 * Zero fallback/default probability paths.
 */

import { runColdStartPredictionPipeline } from './coldStartPredictionPipeline';
import { COLDSTART_WEIGHT_CONTRACT } from './coldStartWeightContract';

export { COLDSTART_WEIGHT_CONTRACT as STEP22_OPTIMIZED_WEIGHTS };

export function predictColdStartMatch(params = {}) {
  return runColdStartPredictionPipeline(params);
}
