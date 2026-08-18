/**
 * Canonical Pre-Match Feature Engine (Step 21)
 * Combines all multi-evidence factors strictly prior to target kickoff.
 * Invariant: match.kickoffAtMs < target.kickoffAtMs
 */

import { computeTeamStrength } from './teamStrengthEngine';
import { computeRecentForm } from './formEngine';
import { computeOpponentTierPerformance } from './opponentStrengthEngine';
import { computeCommonOpponentEvidence } from './commonOpponentEngine';
import { computeHomeAwayStrength } from './homeAwayStrengthEngine';
import { computeLeagueStrength } from './leagueStrengthEngine';
import { computePlayerSquadFactors } from './playerStrengthEngine';
import { classifyEvidenceQuality } from './predictionConfidence';

export function extractPreMatchFeatures(trainingMatches = [], homeTeam = '', awayTeam = '', kickoffAt = null, leagueHome = 'ENG_PL', leagueAway = 'ENG_PL', preMatchSquadData = null) {
  const teamStrength = computeTeamStrength(trainingMatches, homeTeam, awayTeam, kickoffAt);
  const formHome = computeRecentForm(trainingMatches, homeTeam, 5);
  const formAway = computeRecentForm(trainingMatches, awayTeam, 5);
  const oppTierHome = computeOpponentTierPerformance(trainingMatches, homeTeam, kickoffAt);
  const oppTierAway = computeOpponentTierPerformance(trainingMatches, awayTeam, kickoffAt);
  const commonOpp = computeCommonOpponentEvidence(trainingMatches, homeTeam, awayTeam);
  const homeAway = computeHomeAwayStrength(trainingMatches, homeTeam, awayTeam);
  const leagueStr = computeLeagueStrength(leagueHome, leagueAway);
  const playerData = computePlayerSquadFactors(homeTeam, awayTeam, preMatchSquadData);

  const evidenceMap = {
    teamStrength,
    recentFormHome: formHome,
    recentFormAway: formAway,
    opponentStrengthHome: oppTierHome,
    opponentStrengthAway: oppTierAway,
    commonOpponents: commonOpp,
    homeAway,
    leagueStrength: leagueStr,
    playerData
  };

  const evidenceQuality = classifyEvidenceQuality(evidenceMap, trainingMatches.length);

  return {
    eloDifference: teamStrength.eloDiff,
    homeElo: teamStrength.home.elo,
    awayElo: teamStrength.away.elo,
    formDifference: formHome.pointsAvg - formAway.pointsAvg,
    goalDiffDifference: teamStrength.home.gdAvg - teamStrength.away.gdAvg,
    commonOpponentDiff: commonOpp.differential,
    homeAwayWinRateDiff: homeAway.winRateDiff,
    leagueStrengthDiff: leagueStr.differential,
    evidenceQuality,
    evidenceMap
  };
}
