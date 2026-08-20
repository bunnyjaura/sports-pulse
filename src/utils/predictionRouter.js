import { predictMatch } from './predictionEngine';
import { predictColdStartMatch } from './coldStartModel';
import { predictStrengthPriorMatch } from './strengthPriorModel';
import { getPreMatchMatches } from './preMatchFilter';
import { evaluateEvidenceAvailability } from './evidenceAvailability';
import { evaluateColdStartEvidence } from './coldStartEvidenceGate';
import { getCanonicalTeamId } from './teamIdentity';
import { normalizeHistoricalMatch } from './historicalDataAdapter';
import { getPreMatchPrior } from './hierarchicalPriorEngine';
import { computeEloDatabase } from './eloEngine';
import { normalizeKickoffDate } from './dateNormalizer';

function predictCatBoostEloDiff(eloDiff) {
  const zHome = 0.22 + (0.0038 * eloDiff);
  const zDraw = -0.35 - (0.0005 * Math.abs(eloDiff));
  const zAway = -0.15 - (0.0036 * eloDiff);

  const expH = Math.exp(zHome);
  const expD = Math.exp(zDraw);
  const expA = Math.exp(zAway);
  const sum = expH + expD + expA;

  return { home: expH / sum, draw: expD / sum, away: expA / sum };
}

function applyTemperatureScaling(pProbs, temp = 1.25) {
  const logH = Math.log(Math.max(1e-15, pProbs.home)) / temp;
  const logD = Math.log(Math.max(1e-15, pProbs.draw)) / temp;
  const logA = Math.log(Math.max(1e-15, pProbs.away)) / temp;

  const maxLog = Math.max(logH, logD, logA);
  const expH = Math.exp(logH - maxLog);
  const expD = Math.exp(logD - maxLog);
  const expA = Math.exp(logA - maxLog);
  const sum = expH + expD + expA;

  return { home: expH / sum, draw: expD / sum, away: expA / sum };
}

export function routeMatchPrediction({ homeTeam = '', awayTeam = '', kickoffAt = null, historicalMatches = [], leagueHome = 'ENG_PL', leagueAway = 'ENG_PL', preMatchSquadData = null, targetMatch = null }) {
  const targetHome = targetMatch?.homeTeam || targetMatch?.homeTeamName || homeTeam;
  const targetAway = targetMatch?.awayTeam || targetMatch?.awayTeamName || awayTeam;
  const rawCutoff = kickoffAt || (targetMatch ? targetMatch.kickoffAt || targetMatch.date : new Date().toISOString());

  // 1. DATA INTEGRITY CHECK: Invalid Team Identity
  const homeId = getCanonicalTeamId(targetHome);
  const awayId = getCanonicalTeamId(targetAway);

  if (!homeId || !awayId || homeId === awayId) {
    return {
      modelVersion: 'NONE',
      predictionMode: 'UNAVAILABLE',
      status: 'UNAVAILABLE',
      reasonCode: 'INVALID_TEAM_IDENTITY',
      message: 'Invalid or identical team parameters provided.',
      probabilities: null,
      predictedOutcome: null,
      generatedAt: new Date().toISOString(),
      historicalCutoff: rawCutoff,
      provenance: {
        targetExcluded: true,
        futureMatchesExcluded: true,
        oddsUsed: false,
        fallbackUsed: false,
        fallbackReason: 'INVALID_TEAM_IDENTITY'
      }
    };
  }

  // 2. DATA INTEGRITY CHECK: Invalid Kickoff Timestamp
  const cutoffNorm = normalizeKickoffDate(rawCutoff);
  if (!cutoffNorm.isValid) {
    return {
      modelVersion: 'NONE',
      predictionMode: 'UNAVAILABLE',
      status: 'UNAVAILABLE',
      reasonCode: 'INVALID_KICKOFF_TIMESTAMP',
      message: 'Invalid kickoff timestamp format or date.',
      probabilities: null,
      predictedOutcome: null,
      generatedAt: new Date().toISOString(),
      historicalCutoff: rawCutoff,
      provenance: {
        targetExcluded: true,
        futureMatchesExcluded: true,
        oddsUsed: false,
        fallbackUsed: false,
        fallbackReason: 'INVALID_KICKOFF_TIMESTAMP'
      }
    };
  }

  const cutoff = cutoffNorm.isoString;

  // 3. Strict pre-kickoff match filtering (t < T)
  const validHistory = getPreMatchMatches(historicalMatches, targetMatch, cutoff);
  const normalizedHistory = validHistory.map(m => normalizeHistoricalMatch(m)).filter(m => m && m.homeTeamName);

  // Direct H2H Count
  const directH2HMatches = normalizedHistory.filter(m => {
    const h = m.homeTeamId || getCanonicalTeamId(m.homeTeamName);
    const a = m.awayTeamId || getCanonicalTeamId(m.awayTeamName);
    return (h === homeId && a === awayId) || (h === awayId && a === homeId);
  });
  const directH2HCount = directH2HMatches.length;

  // Team History
  const teamAMatches = normalizedHistory.filter(m => {
    const h = m.homeTeamId || getCanonicalTeamId(m.homeTeamName);
    const a = m.awayTeamId || getCanonicalTeamId(m.awayTeamName);
    return h === homeId || a === homeId;
  });

  const teamBMatches = normalizedHistory.filter(m => {
    const h = m.homeTeamId || getCanonicalTeamId(m.homeTeamName);
    const a = m.awayTeamId || getCanonicalTeamId(m.awayTeamName);
    return h === awayId || a === awayId;
  });

  const evidenceEval = evaluateEvidenceAvailability({
    directH2HCount,
    teamAHistoryCount: teamAMatches.length,
    teamBHistoryCount: teamBMatches.length,
    recentFormCountA: Math.min(teamAMatches.length, 10),
    recentFormCountB: Math.min(teamBMatches.length, 10),
    oppAdjustedCountA: Math.min(teamAMatches.length, 10),
    oppAdjustedCountB: Math.min(teamBMatches.length, 10),
    homeAwayCountA: Math.min(teamAMatches.length, 10),
    homeAwayCountB: Math.min(teamBMatches.length, 10),
    commonOpponentsCount: 0,
    leagueMatchesCount: normalizedHistory.length,
    playerDataAvailable: !!preMatchSquadData
  });

  const gateEval = evaluateColdStartEvidence(evidenceEval.categories, normalizedHistory.length);

  // 4. ROUTE TO FULL_HISTORY (football-ensemble-v1) IF BOTH TEAMS HAVE >= 50 PRE-KICKOFF MATCHES
  if (teamAMatches.length >= 50 && teamBMatches.length >= 50) {
    const fullResult = predictMatch({
      homeTeam: targetHome,
      awayTeam: targetAway,
      kickoffAt: cutoff,
      historicalMatches: validHistory,
      historicalCutoff: cutoff
    });

    if (fullResult.status === 'SUCCESS') {
      return {
        modelVersion: 'football-ensemble-v1',
        predictionMode: 'FULL_HISTORY',
        status: 'SUCCESS',
        probabilities: fullResult.probabilities,
        components: fullResult.components,
        predictedOutcome: fullResult.predictedOutcome,
        evidenceQuality: 'HIGH EVIDENCE',
        evidenceAvailability: evidenceEval,
        gateEval,
        historicalObservations: directH2HCount,
        historyCountHome: teamAMatches.length,
        historyCountAway: teamBMatches.length,
        priorSourceHome: 'HISTORICAL_DATA',
        priorSourceAway: 'HISTORICAL_DATA',
        fallbackUsed: false,
        fallbackReason: 'NONE',
        confidence: 'MODERATE',
        generatedAt: fullResult.generatedAt,
        historicalCutoff: cutoff,
        meta: fullResult.meta,
        provenance: {
          targetExcluded: true,
          futureMatchesExcluded: true,
          oddsUsed: false,
          fallbackUsed: false,
          fallbackReason: 'NONE'
        }
      };
    }
  }

  // 5. ROUTE TO COLD_START (football-coldstart-v2) IF BOTH TEAMS HAVE >= 1 MATCH LOG (min < 50)
  if (teamAMatches.length >= 1 && teamBMatches.length >= 1) {
    const coldResult = predictColdStartMatch({
      homeTeam: targetHome,
      awayTeam: targetAway,
      kickoffAt: cutoff,
      historicalMatches: validHistory,
      leagueHome,
      leagueAway,
      preMatchSquadData,
      targetMatch,
      useV2Candidate: true
    });

    if (coldResult.status !== 'UNAVAILABLE' && coldResult.probabilities) {
      return {
        modelVersion: 'football-coldstart-v2',
        predictionMode: directH2HCount > 0 ? 'LIMITED_HISTORY' : 'COLD_START',
        status: 'SUCCESS',
        probabilities: coldResult.probabilities,
        predictedOutcome: coldResult.predictedOutcome,
        evidenceQuality: coldResult.evidenceQuality,
        evidence: coldResult.evidence,
        evidenceAvailability: evidenceEval,
        featureContributions: coldResult.featureContributions,
        gateEval,
        weightsUsed: coldResult.effectiveWeights || coldResult.weightsUsed,
        historicalObservations: directH2HCount,
        historyCountHome: teamAMatches.length,
        historyCountAway: teamBMatches.length,
        priorSourceHome: 'HISTORICAL_DATA',
        priorSourceAway: 'HISTORICAL_DATA',
        fallbackUsed: false,
        fallbackReason: 'NONE',
        confidence: 'MODERATE',
        generatedAt: coldResult.generatedAt,
        historicalCutoff: cutoff,
        provenance: {
          targetExcluded: true,
          futureMatchesExcluded: true,
          oddsUsed: false,
          fallbackUsed: false,
          fallbackReason: 'NONE'
        }
      };
    }
  }

  // Build Pre-Kickoff Elo Database & League Totals for Hierarchical Fallbacks (t < T)
  const eloDb = computeEloDatabase(validHistory, cutoff);
  const leagueEloSums = {};
  const leagueEloCounts = {};

  for (const m of normalizedHistory) {
    const h = m.homeTeamId;
    const a = m.awayTeamId;
    const lg = m.competitionId || 'ENG_PL';
    if (h && eloDb[h]) {
      leagueEloSums[lg] = (leagueEloSums[lg] || 0) + eloDb[h];
      leagueEloCounts[lg] = (leagueEloCounts[lg] || 0) + 1;
    }
    if (a && eloDb[a]) {
      leagueEloSums[lg] = (leagueEloSums[lg] || 0) + eloDb[a];
      leagueEloCounts[lg] = (leagueEloCounts[lg] || 0) + 1;
    }
  }

  const resolvedLeagueHome = targetMatch?.league?.id || targetMatch?.leagueId || leagueHome || 'ENG_PL';
  const resolvedLeagueAway = targetMatch?.league?.id || targetMatch?.leagueId || leagueAway || 'ENG_PL';

  // 6. ROUTE TO SINGLE_TEAM_FALLBACK IF EXACTLY ONE TEAM HAS 0 HISTORY
  if ((teamAMatches.length >= 1 && teamBMatches.length === 0) || (teamAMatches.length === 0 && teamBMatches.length >= 1)) {
    const priorH = getPreMatchPrior({ teamName: targetHome, leagueId: resolvedLeagueHome, eloDb, leagueEloSums, leagueEloCounts });
    const priorA = getPreMatchPrior({ teamName: targetAway, leagueId: resolvedLeagueAway, eloDb, leagueEloSums, leagueEloCounts });

    const pRaw = predictCatBoostEloDiff(priorH.elo - priorA.elo);
    const pCalibrated = applyTemperatureScaling(pRaw, 1.25);

    const predictedOutcome = pCalibrated.home >= pCalibrated.draw && pCalibrated.home >= pCalibrated.away ? 'Home' : (pCalibrated.draw >= pCalibrated.away ? 'Draw' : 'Away');

    return {
      modelVersion: 'football-hierarchical-prior-v1',
      predictionMode: 'SINGLE_TEAM_FALLBACK',
      status: 'SUCCESS',
      probabilities: pCalibrated,
      predictedOutcome,
      evidenceQuality: 'LOW EVIDENCE (SINGLE TEAM HIERARCHICAL FALLBACK)',
      confidence: 'LOW',
      reasonCode: 'SINGLE_TEAM_EVIDENCE_GAP',
      message: 'Single-team history gap recovered via pre-kickoff hierarchical priors.',
      evidenceAvailability: evidenceEval,
      gateEval,
      historicalObservations: directH2HCount,
      historyCountHome: teamAMatches.length,
      historyCountAway: teamBMatches.length,
      priorSourceHome: priorH.source,
      priorSourceAway: priorA.source,
      fallbackUsed: true,
      fallbackReason: 'SINGLE_TEAM_EVIDENCE_GAP',
      generatedAt: new Date().toISOString(),
      historicalCutoff: cutoff,
      meta: {
        homeTeamId: homeId,
        awayTeamId: awayId,
        homeElo: priorH.elo,
        awayElo: priorA.elo,
        eloDiff: priorH.elo - priorA.elo
      },
      provenance: {
        targetExcluded: true,
        futureMatchesExcluded: true,
        oddsUsed: false,
        fallbackUsed: true,
        fallbackReason: 'SINGLE_TEAM_EVIDENCE_GAP'
      }
    };
  }

  // 7. ROUTE TO BOTH_UNKNOWN_PRIOR IF BOTH TEAMS HAVE 0 HISTORY
  const priorH = getPreMatchPrior({ teamName: targetHome, leagueId: resolvedLeagueHome, eloDb, leagueEloSums, leagueEloCounts });
  const priorA = getPreMatchPrior({ teamName: targetAway, leagueId: resolvedLeagueAway, eloDb, leagueEloSums, leagueEloCounts });

  const pRaw = predictCatBoostEloDiff(priorH.elo - priorA.elo);
  const pCalibrated = applyTemperatureScaling(pRaw, 1.25);
  const predictedOutcome = pCalibrated.home >= pCalibrated.draw && pCalibrated.home >= pCalibrated.away ? 'Home' : (pCalibrated.draw >= pCalibrated.away ? 'Draw' : 'Away');

  return {
    modelVersion: 'football-hierarchical-prior-v1',
    predictionMode: 'BOTH_UNKNOWN',
    status: 'SUCCESS',
    probabilities: pCalibrated,
    predictedOutcome,
    evidenceQuality: 'LOW EVIDENCE (HIERARCHICAL LEAGUE PRIOR)',
    confidence: 'LOW',
    reasonCode: 'BOTH_TEAMS_ZERO_HISTORY',
    message: 'Both teams lack historical matches. Prediction based on pre-kickoff competition hierarchical priors.',
    evidenceAvailability: evidenceEval,
    gateEval,
    historicalObservations: 0,
    historyCountHome: 0,
    historyCountAway: 0,
    priorSourceHome: priorH.source,
    priorSourceAway: priorA.source,
    fallbackUsed: true,
    fallbackReason: 'BOTH_TEAMS_ZERO_HISTORY',
    generatedAt: new Date().toISOString(),
    historicalCutoff: cutoff,
    meta: {
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeElo: priorH.elo,
      awayElo: priorA.elo,
      eloDiff: priorH.elo - priorA.elo
    },
    provenance: {
      targetExcluded: true,
      futureMatchesExcluded: true,
      oddsUsed: false,
      fallbackUsed: true,
      fallbackReason: 'BOTH_TEAMS_ZERO_HISTORY'
    }
  };
}

