/**
 * Past Match Pre-Match Audit Reconstruction Service (Step 28 - Step 30)
 * Orchestration layer:
 *  1. Calls evaluatePastMatchEligibility() FIRST.
 *  2. If excluded (preMatchCount === 0), short-circuits with status: 'EXCLUDED' and prediction: null.
 *  3. Runs auditTargetIsolation() to enforce strict pre-kickoff t < T invariant.
 *  4. Calls auditHistoricalState() & predictionRouter.
 *  5. Runs auditFeatureConnectivity() for controlled feature perturbation.
 *  6. Validates probability integrity (0 <= P <= 1, sum(P) === 1.0 ± 1e-12, zero NaN/Inf).
 *  7. If team-specific evidence is unavailable, returns status: 'UNAVAILABLE' and probabilities: null.
 */

import { evaluatePastMatchEligibility } from '../utils/pastMatchEligibility';
import { getPreMatchMatches } from '../utils/preMatchFilter';
import { auditColdStartPrediction } from '../utils/coldStartAudit';
import { auditHistoricalState } from '../utils/historicalStateAudit';
import { getPreMatchDiagnostics, getHistoricalDatasetDiagnostics } from '../utils/historicalDataDiagnostics';
import { normalizeKickoffDate } from '../utils/dateNormalizer';
import { normalizeTeamName } from '../utils/teamNormalizer';
import { COLDSTART_WEIGHT_CONTRACT, validateWeightContract } from '../utils/coldStartWeightContract';
import { auditTargetIsolation } from '../utils/targetIsolationAudit';
import { auditFeatureConnectivity } from '../utils/coldStartConnectivityAudit';
import { predictColdStartMatch } from '../utils/coldStartModel';
import { assertProbabilityIntegrity } from '../utils/probabilityIntegrity';

export class PastMatchAuditService {
  /**
   * Performs pre-match prediction audit on a selected completed historical match.
   * 
   * @param {Object} targetMatch - The target completed match
   * @param {Array} fullDataset - Full historical matches dataset
   * @returns {Object} Complete audit result record (status: 'PREDICTED' | 'EXCLUDED' | 'UNAVAILABLE')
   */
  static auditPastMatch(targetMatch, fullDataset) {
    if (!targetMatch) {
      throw new Error("Invalid target match provided for audit.");
    }

    const normHome = normalizeTeamName(targetMatch.homeTeam);
    const normAway = normalizeTeamName(targetMatch.awayTeam);
    const targetDateNorm = normalizeKickoffDate(targetMatch.kickoffAt || targetMatch.date);

    // 1. EVALUATE DATASET ELIGIBILITY FIRST
    const eligibility = evaluatePastMatchEligibility(targetMatch, fullDataset);

    if (!eligibility.eligible) {
      return {
        status: 'EXCLUDED',
        reasonCode: eligibility.reasonCode || 'NO_PRE_MATCH_DATA',
        targetMatch: {
          id: targetMatch.id,
          homeTeam: normHome,
          awayTeam: normAway,
          date: targetDateNorm.isValid ? targetDateNorm.isoString.split('T')[0] : targetMatch.date,
          kickoffAt: targetDateNorm.isValid ? targetDateNorm.isoString : targetMatch.date
        },
        eligibility,
        prediction: null,
        datasetDiagnostics: getHistoricalDatasetDiagnostics(fullDataset),
        preMatchDiagnostics: getPreMatchDiagnostics(fullDataset, targetMatch)
      };
    }

    // 2. TARGET IS ELIGIBLE -> GENERATE PRE-MATCH AUDIT PREDICTION (t < T)
    const trainingMatches = getPreMatchMatches(fullDataset, targetMatch, targetDateNorm.isoString);

    // 3. TARGET ISOLATION AUDIT (Enforce t < T)
    const targetIsolation = auditTargetIsolation(targetMatch, trainingMatches);

    // 4. HISTORICAL STATE AUDIT DIAGNOSTIC
    const stateAudit = auditHistoricalState(targetMatch, fullDataset);

    const datasetDiagnostics = getHistoricalDatasetDiagnostics(fullDataset);
    const preMatchDiagnostics = getPreMatchDiagnostics(fullDataset, targetMatch);

    const auditedResult = auditColdStartPrediction({
      homeTeam: normHome,
      awayTeam: normAway,
      kickoffAt: targetDateNorm.isoString,
      historicalMatches: trainingMatches,
      leagueHome: targetMatch.leagueId || 'ENG_PL',
      leagueAway: targetMatch.leagueId || 'ENG_PL',
      targetMatch
    });

    const weightContractValidation = validateWeightContract(COLDSTART_WEIGHT_CONTRACT);

    if (auditedResult.status === 'UNAVAILABLE' || !auditedResult.probabilities) {
      return {
        status: 'UNAVAILABLE',
        reasonCode: auditedResult.reasonCode || 'NO_TEAM_SPECIFIC_PRE_MATCH_EVIDENCE',
        probabilities: null,
        targetMatch: {
          id: targetMatch.id,
          homeTeam: normHome,
          awayTeam: normAway,
          date: targetDateNorm.isoString.split('T')[0],
          kickoffAt: targetDateNorm.isoString
        },
        eligibility,
        targetIsolation,
        weightContractValidation,
        stateAudit,
        datasetDiagnostics,
        preMatchDiagnostics,
        predictionMode: 'UNAVAILABLE',
        modelVersion: 'NONE',
        contractVersion: COLDSTART_WEIGHT_CONTRACT.version,
        evidenceAvailability: auditedResult.evidenceAvailability,
        gateEval: auditedResult.gateEval,
        integrityChecklist: auditedResult.integrityChecklist
      };
    }

    // 5. PROBABILITY INTEGRITY ASSERTION
    const isProbValid = assertProbabilityIntegrity(auditedResult.probabilities);
    if (!isProbValid) {
      return {
        status: 'UNAVAILABLE',
        reasonCode: 'PROBABILITY_NORMALIZATION_FAILED',
        probabilities: null,
        targetMatch: {
          id: targetMatch.id,
          homeTeam: normHome,
          awayTeam: normAway,
          date: targetDateNorm.isoString.split('T')[0],
          kickoffAt: targetDateNorm.isoString
        },
        eligibility,
        targetIsolation,
        weightContractValidation
      };
    }

    // 6. FEATURE CONNECTIVITY PERTURBATION AUDIT
    const predictRunner = (stateInput) => predictColdStartMatch({
      homeTeam: normHome,
      awayTeam: normAway,
      kickoffAt: targetDateNorm.isoString,
      historicalMatches: trainingMatches,
      leagueHome: targetMatch.leagueId || 'ENG_PL',
      leagueAway: targetMatch.leagueId || 'ENG_PL',
      targetMatch,
      perturbedFeatureValues: stateInput.perturbedFeatureValues
    });

    const connectivityAudit = auditFeatureConnectivity(predictRunner, { targetMatch });

    const actualResult = targetMatch.FTR; // 'H', 'D', or 'A'
    const targetMap = { 'H': 'home', 'D': 'draw', 'A': 'away' };
    const actualOutcomeKey = targetMap[actualResult] || 'home';

    const p_h = auditedResult.probabilities.home;
    const p_d = auditedResult.probabilities.draw;
    const p_a = auditedResult.probabilities.away;

    const actualProb = actualOutcomeKey === 'home' ? p_h : (actualOutcomeKey === 'draw' ? p_d : p_a);
    const logLoss = -Math.log(Math.max(1e-6, actualProb));

    const y_h = actualResult === 'H' ? 1.0 : 0.0;
    const y_d = actualResult === 'D' ? 1.0 : 0.0;
    const y_a = actualResult === 'A' ? 1.0 : 0.0;
    const brierScore = Math.pow(p_h - y_h, 2) + Math.pow(p_d - y_d, 2) + Math.pow(p_a - y_a, 2);

    const predictedClassKey = p_h >= p_d && p_h >= p_a ? 'H' : (p_d >= p_a ? 'D' : 'A');
    const isCorrect = predictedClassKey === actualResult;

    return {
      status: 'PREDICTED',
      predictionMode: auditedResult.predictionMode,
      modelVersion: auditedResult.modelVersion,
      contractVersion: COLDSTART_WEIGHT_CONTRACT.version,
      predictionPath: 'CONNECTED',
      fallbackUsed: false,
      targetMatch: {
        id: targetMatch.id,
        homeTeam: normHome,
        awayTeam: normAway,
        date: targetDateNorm.isoString.split('T')[0],
        timeIST: targetMatch.timeIST,
        league: targetMatch.league || 'Premier League',
        season: targetMatch.season || '2024-25',
        score: {
          home: targetMatch.FTHG,
          away: targetMatch.FTAG
        },
        actualResult: actualResult,
        actualWinner: actualResult === 'H' ? normHome : (actualResult === 'A' ? normAway : 'Draw')
      },
      eligibility,
      targetIsolation,
      weightContractValidation,
      connectivityAudit,
      stateAudit,
      prediction: auditedResult,
      evidenceQuality: auditedResult.evidenceQuality,
      evidence: auditedResult.evidence,
      featureContributions: auditedResult.featureContributions,
      evidenceAvailability: auditedResult.evidenceAvailability,
      gateEval: auditedResult.gateEval,
      weightsUsed: auditedResult.weightsUsed,
      integrityChecklist: auditedResult.integrityChecklist,
      reliabilityMetrics: auditedResult.reliabilityMetrics,
      dataSufficiency: {
        status: auditedResult.predictionMode,
        trainingMatchCount: trainingMatches.length,
        directH2HCount: auditedResult.historicalObservations
      },
      datasetDiagnostics,
      preMatchDiagnostics,
      evaluation: {
        logLoss: logLoss,
        brierScore: brierScore,
        isCorrect: isCorrect,
        actualProb: actualProb
      },
      provenance: auditedResult.provenance
    };
  }
}
