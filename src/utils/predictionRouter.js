/**
 * Central Deterministic Prediction Router (Step 27 - Step 30)
 * Enforces evidence quality taxonomy & team-specific evidence requirement:
 *  - Direct H2H >= 50 -> FULL_HISTORY (football-ensemble-v1)
 *  - Direct H2H < 50 + team-specific evidence available -> COLD_START (football-coldstart-v2)
 *  - Zero team-specific evidence (e.g. League Strength only) -> UNAVAILABLE (probabilities: null)
 */

import { predictMatch } from './predictionEngine';
import { predictColdStartMatch } from './coldStartModel';
import { getPreMatchMatches } from './preMatchFilter';
import { evaluateEvidenceAvailability } from './evidenceAvailability';
import { evaluateColdStartEvidence } from './coldStartEvidenceGate';
import { normalizeTeamName } from './teamNormalizer';
import { normalizeHistoricalMatch } from './historicalDataAdapter';

export function routeMatchPrediction({ homeTeam = '', awayTeam = '', kickoffAt = null, historicalMatches = [], leagueHome = 'ENG_PL', leagueAway = 'ENG_PL', preMatchSquadData = null, targetMatch = null }) {
  const targetHome = targetMatch?.homeTeam || targetMatch?.homeTeamName || homeTeam;
  const targetAway = targetMatch?.awayTeam || targetMatch?.awayTeamName || awayTeam;
  const cutoff = kickoffAt || (targetMatch ? targetMatch.kickoffAt || targetMatch.date : new Date().toISOString());
  
  // 1. Strict pre-kickoff match filtering (t < T)
  const validHistory = getPreMatchMatches(historicalMatches, targetMatch, cutoff);

  const normHome = normalizeTeamName(targetHome).toLowerCase();
  const normAway = normalizeTeamName(targetAway).toLowerCase();

  // Normalize historical matches for resilient field name access (HomeTeam vs homeTeam)
  const normalizedHistory = validHistory.map(m => normalizeHistoricalMatch(m)).filter(m => m && m.homeTeamName);

  // 2. Direct H2H Count
  const directH2HMatches = normalizedHistory.filter(m => {
    const h = normalizeTeamName(m.homeTeamName).toLowerCase();
    const a = normalizeTeamName(m.awayTeamName).toLowerCase();
    return (h === normHome && a === normAway) || (h === normAway && a === normHome);
  });
  const directH2HCount = directH2HMatches.length;

  // 3. Broader Team History
  const teamAMatches = normalizedHistory.filter(m => {
    const h = normalizeTeamName(m.homeTeamName).toLowerCase();
    const a = normalizeTeamName(m.awayTeamName).toLowerCase();
    return h === normHome || a === normHome;
  });

  const teamBMatches = normalizedHistory.filter(m => {
    const h = normalizeTeamName(m.homeTeamName).toLowerCase();
    const a = normalizeTeamName(m.awayTeamName).toLowerCase();
    return h === normAway || a === normAway;
  });

  // Evaluate Evidence Availability & Gate
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

  // 4. ROUTE TO FULL_HISTORY (football-ensemble-v1) IF DIRECT H2H >= 50
  if (directH2HCount >= 50) {
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
        generatedAt: fullResult.generatedAt,
        historicalCutoff: cutoff,
        meta: fullResult.meta,
        provenance: {
          targetExcluded: true,
          futureMatchesExcluded: true,
          oddsUsed: false
        }
      };
    }
  }

  // 5. ROUTE TO COLD_START (football-coldstart-v2) IF TEAM-SPECIFIC EVIDENCE GATE IS ELIGIBLE
  if (gateEval.eligible) {
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

    if (coldResult.status === 'UNAVAILABLE' || !coldResult.probabilities) {
      return {
        modelVersion: 'NONE',
        predictionMode: 'UNAVAILABLE',
        status: 'UNAVAILABLE',
        reasonCode: coldResult.reasonCode || 'NO_TEAM_SPECIFIC_PRE_MATCH_EVIDENCE',
        probabilities: null,
        predictedOutcome: null,
        evidenceAvailability: evidenceEval,
        gateEval,
        historicalObservations: directH2HCount,
        generatedAt: new Date().toISOString(),
        historicalCutoff: cutoff,
        provenance: {
          targetExcluded: true,
          futureMatchesExcluded: true,
          oddsUsed: false
        }
      };
    }

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
      generatedAt: coldResult.generatedAt,
      historicalCutoff: cutoff,
      provenance: coldResult.provenance
    };
  }

  // 6. ZERO TEAM-SPECIFIC EVIDENCE -> UNAVAILABLE (probabilities: null)
  return {
    modelVersion: 'NONE',
    predictionMode: 'UNAVAILABLE',
    status: 'UNAVAILABLE',
    reasonCode: gateEval.reasonCode || 'NO_TEAM_SPECIFIC_PRE_MATCH_EVIDENCE',
    probabilities: null,
    predictedOutcome: null,
    evidenceAvailability: evidenceEval,
    gateEval,
    historicalObservations: directH2HCount,
    generatedAt: new Date().toISOString(),
    historicalCutoff: cutoff,
    provenance: {
      targetExcluded: true,
      futureMatchesExcluded: true,
      oddsUsed: false
    }
  };
}
