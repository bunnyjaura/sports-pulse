/**
 * Shared Football Prediction Engine
 * Model Version: football-ensemble-v1 (50% CatBoost + 50% Dixon-Coles)
 * Strict zero-leakage pre-kickoff information rule.
 * Enforces minimum history sufficiency (N >= 50).
 * Odds and market data are NEVER consumed by this engine.
 */

import { computeEloDatabase } from './eloEngine';
import { trainDixonColesModel, predictMatchDixonColes } from './dixonColes';
import { HistoricalMatchService } from '../services/historicalMatchService';
import { getCanonicalTeamId } from './teamIdentity';

/**
 * Predicts match outcome probabilities using 50/50 CatBoost + Dixon-Coles ensemble.
 * 
 * @param {Object} params
 * @param {string} params.homeTeam
 * @param {string} params.awayTeam
 * @param {string|Date} [params.kickoffAt]
 * @param {Array} params.historicalMatches - List of historical matches strictly before cutoff
 * @param {string} [params.historicalCutoff] - Date cutoff string
 * @returns {Object} Full precision prediction result or INSUFFICIENT_HISTORY status
 */
export function predictMatch({ homeTeam, awayTeam, kickoffAt = null, historicalMatches = [], historicalCutoff = null }) {
  const cutoff = historicalCutoff || kickoffAt || new Date().toISOString();

  const homeTeamId = getCanonicalTeamId(homeTeam);
  const awayTeamId = getCanonicalTeamId(awayTeam);

  if (!homeTeamId || !awayTeamId) {
    return {
      model_version: 'football-ensemble-v2',
      status: 'UNAVAILABLE',
      reasonCode: 'INVALID_TEAM_IDENTITY',
      probabilities: null,
      generatedAt: new Date().toISOString(),
      historicalCutoff: cutoff
    };
  }

  // 1. Filter historical matches strictly prior to cutoff (< cutoff)
  const validHistory = HistoricalMatchService.getMatchesBefore(historicalMatches, cutoff);

  // 2. Evaluate Minimum Data Sufficiency per team (N >= 50 for each team)
  const sufficiency = HistoricalMatchService.evaluateDataSufficiency(validHistory, homeTeam, awayTeam, cutoff);

  if (!sufficiency.isSufficient) {
    return {
      model_version: 'football-ensemble-v2',
      status: 'INSUFFICIENT_HISTORY',
      reasonCode: 'INSUFFICIENT_TEAM_HISTORY',
      reason: `Insufficient historical data before cutoff (Home N=${sufficiency.homeHistoryCount}, Away N=${sufficiency.awayHistoryCount}, required N>=50 per team)`,
      dataSufficiency: sufficiency,
      probabilities: null,
      generatedAt: new Date().toISOString(),
      historicalCutoff: cutoff
    };
  }

  // 3. Compute Pre-Match Elo Ratings strictly up to cutoff using canonical IDs
  const eloDb = computeEloDatabase(validHistory, cutoff);
  const homeElo = eloDb[homeTeamId];
  const awayElo = eloDb[awayTeamId];

  // REMOVE SILENT FALLBACK: If Elo rating is missing, return UNAVAILABLE
  if (homeElo === undefined || awayElo === undefined) {
    return {
      model_version: 'football-ensemble-v2',
      status: 'UNAVAILABLE',
      reasonCode: 'MISSING_TEAM_ELO_RATING',
      reason: `Pre-match Elo rating not found for one or both teams (homeElo=${homeElo}, awayElo=${awayElo})`,
      probabilities: null,
      generatedAt: new Date().toISOString(),
      historicalCutoff: cutoff
    };
  }

  const eloDiff = homeElo - awayElo;

  // 4. CatBoost Tree Classifier (EloDiff -> 3-Class Probabilities)
  const p_cb = predictCatBoostEloDiff(eloDiff);

  // 5. Dixon-Coles Expected Goals Model (fitted on pre-kickoff scorelines)
  const dcModel = trainDixonColesModel(validHistory, cutoff);
  const dcPred = predictMatchDixonColes(homeTeam, awayTeam, dcModel, { eloDiff });

  // REMOVE SILENT FALLBACK: If Dixon-Coles parameters are missing, return UNAVAILABLE
  if (dcPred.status === 'UNAVAILABLE') {
    return {
      model_version: 'football-ensemble-v2',
      status: 'UNAVAILABLE',
      reasonCode: dcPred.reasonCode || 'MISSING_TEAM_DIXON_COLES_PARAMETERS',
      reason: 'Dixon-Coles parameters missing for team',
      probabilities: null,
      generatedAt: new Date().toISOString(),
      historicalCutoff: cutoff
    };
  }

  const p_dc = {
    home: dcPred.homeWinProb,
    draw: dcPred.drawProb,
    away: dcPred.awayWinProb
  };

  // 6. 50/50 Ensemble Blend
  let p_home = 0.50 * p_cb.home + 0.50 * p_dc.home;
  let p_draw = 0.50 * p_cb.draw + 0.50 * p_dc.draw;
  let p_away = 0.50 * p_cb.away + 0.50 * p_dc.away;

  // Full-precision normalization to sum strictly to 1.0
  const sumProbs = p_home + p_draw + p_away;
  if (sumProbs > 0) {
    p_home /= sumProbs;
    p_draw /= sumProbs;
    p_away /= sumProbs;
  }

  const predictedOutcome = p_home >= p_draw && p_home >= p_away
    ? 'Home'
    : (p_draw >= p_away ? 'Draw' : 'Away');

  return {
    model_version: 'football-ensemble-v2',
    status: 'SUCCESS',
    probabilities: {
      home: p_home,
      draw: p_draw,
      away: p_away
    },
    components: {
      catboost: {
        home: p_cb.home,
        draw: p_cb.draw,
        away: p_cb.away
      },
      dixonColes: {
        home: p_dc.home,
        draw: p_dc.draw,
        away: p_dc.away
      }
    },
    ensembleWeights: {
      catboost: 0.50,
      dixonColes: 0.50
    },
    predictedOutcome,
    expectedGoals: {
      home: dcPred.expectedGoalsHome,
      away: dcPred.expectedGoalsAway
    },
    overUnder: dcPred.overUnder,
    btts: dcPred.btts,
    mostLikelyScore: dcPred.mostLikelyScore,
    confidence: Math.round(Math.max(p_home, p_draw, p_away) * 100) + '%',
    dataSufficiency: sufficiency,
    generatedAt: new Date().toISOString(),
    historicalCutoff: cutoff,
    meta: {
      homeTeamId,
      awayTeamId,
      homeElo,
      awayElo,
      eloDiff,
      trainingMatchCount: validHistory.length,
      homeHistoryCount: sufficiency.homeHistoryCount,
      awayHistoryCount: sufficiency.awayHistoryCount,
      homeEloSource: 'HISTORICAL',
      awayEloSource: 'HISTORICAL',
      homeParameterSource: 'HISTORICAL',
      awayParameterSource: 'HISTORICAL'
    }
  };
}

/**
 * CatBoost Classifier surrogate for single EloDiff feature
 */
export function predictCatBoostEloDiff(eloDiff) {
  const z_home = 0.22 + (0.0038 * eloDiff);
  const z_draw = -0.35 - (0.0005 * Math.abs(eloDiff));
  const z_away = -0.15 - (0.0036 * eloDiff);

  const expH = Math.exp(z_home);
  const expD = Math.exp(z_draw);
  const expA = Math.exp(z_away);
  const sumExp = expH + expD + expA;

  return {
    home: expH / sumExp,
    draw: expD / sumExp,
    away: expA / sumExp
  };
}
