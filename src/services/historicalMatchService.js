/**
 * Historical Match Query Service (Step 20)
 * Uses canonical HistoricalDataService to load 16,100+ multi-league matches (2016-2026).
 * Strictly filters matches using numerical timestamp comparison: match.kickoffAtMs < target.kickoffAtMs
 */

import { HistoricalDataService } from './historicalDataService';
import { normalizeKickoffDate } from '../utils/dateNormalizer';
import { normalizeTeamName } from '../utils/teamNormalizer';
import { getCanonicalTeamId } from '../utils/teamIdentity';
import { getPreMatchDiagnostics } from '../utils/historicalDataDiagnostics';

export class HistoricalMatchService {
  /**
   * Returns all 16,100+ multi-league historical matches sorted chronologically.
   */
  static async loadHistoricalMatches() {
    const { matches } = HistoricalDataService.loadDataset();
    return matches;
  }

  /**
   * Strictly filters historical matches prior to target kickoff.
   * HARD INVARIANT: trainingMatch.kickoffAtMs < targetMatch.kickoffAtMs
   */
  static getMatchesBefore(matches, targetKickoff, targetMatchId = null) {
    const targetDateNorm = normalizeKickoffDate(targetKickoff);
    if (!targetDateNorm.isValid) return [];

    const targetMs = targetDateNorm.timestampMs;

    return matches.filter(m => {
      if (targetMatchId && m.id === targetMatchId) return false; // Exclude target match
      const mMs = m.kickoffAtMs || normalizeKickoffDate(m.kickoffAt || m.date).timestampMs;
      return mMs < targetMs; // Strictly exclude target & future matches
    });
  }

  /**
   * Retrieves team-level match history prior to target cutoff using canonical team ID matching.
   */
  static getTeamHistory(matches, teamNameOrId, cutoff) {
    const validMatches = this.getMatchesBefore(matches, cutoff);
    const targetId = getCanonicalTeamId(teamNameOrId);
    if (!targetId) return [];

    return validMatches.filter(m => {
      const hId = m.homeTeamId || getCanonicalTeamId(m.homeTeam);
      const aId = m.awayTeamId || getCanonicalTeamId(m.awayTeam);
      return hId === targetId || aId === targetId;
    });
  }

  /**
   * Evidence helper: checks if both teams have sufficient team history (>= 50 matches each) for full model.
   */
  static hasFullHistoryEvidence(homeCount, awayCount) {
    return homeCount >= 50 && awayCount >= 50;
  }

  /**
   * Evidence helper: checks if both teams have minimum team history (>= 1 match each) for cold start model.
   */
  static hasColdStartEvidence(homeCount, awayCount) {
    return homeCount >= 1 && awayCount >= 1;
  }

  /**
   * Evaluates minimum training history sufficiency based on individual team pre-kickoff match counts.
   */
  static evaluateDataSufficiency(trainingMatches, homeTeam, awayTeam, cutoff, allMatches = [], targetMatch = null) {
    const homeHist = this.getTeamHistory(trainingMatches, homeTeam, cutoff);
    const awayHist = this.getTeamHistory(trainingMatches, awayTeam, cutoff);

    const homeCount = homeHist.length;
    const awayCount = awayHist.length;

    const isSufficient = this.hasFullHistoryEvidence(homeCount, awayCount);
    let status = 'FULL_HISTORY';

    if (!isSufficient) {
      status = this.hasColdStartEvidence(homeCount, awayCount) ? 'LIMITED_HISTORY' : 'INSUFFICIENT_HISTORY';
    } else if (Math.min(homeCount, awayCount) < 200) {
      status = 'LIMITED_HISTORY';
    } else if (Math.min(homeCount, awayCount) < 500) {
      status = 'MODERATE_HISTORY';
    }

    const diagnostics = targetMatch ? getPreMatchDiagnostics(allMatches, targetMatch) : null;

    return {
      status,
      isSufficient,
      trainingMatchCount: trainingMatches.length,
      requiredMinimum: 50,
      homeHistoryCount: homeCount,
      awayHistoryCount: awayCount,
      homeSource: homeCount > 0 ? 'HISTORICAL' : 'LEAGUE_PRIOR',
      awaySource: awayCount > 0 ? 'HISTORICAL' : 'LEAGUE_PRIOR',
      diagnostics
    };
  }

  static getSeasons(matches) {
    const seasons = new Set(matches.map(m => m.season || '2024-25'));
    seasons.add('2026-27');
    seasons.add('2025-26');
    seasons.add('2024-25');
    return Array.from(seasons).sort().reverse();
  }

  static getLeagues(matches) {
    const leagues = new Set(matches.map(m => m.league || 'Premier League'));
    return Array.from(leagues).sort();
  }

  static getCompletedMatches(matches, options = {}) {
    let filtered = matches.filter(m => m.FTHG !== undefined && m.FTAG !== undefined && m.FTHG !== null);

    if (options.league && options.league !== 'ALL') {
      filtered = filtered.filter(m => (m.league || 'Premier League') === options.league);
    }

    if (options.season && options.season !== 'ALL') {
      filtered = filtered.filter(m => (m.season || '2024-25') === options.season);
    }

    if (options.query) {
      const q = options.query.toLowerCase().trim();
      filtered = filtered.filter(m =>
        m.homeTeam.toLowerCase().includes(q) ||
        m.awayTeam.toLowerCase().includes(q)
      );
    }

    return filtered;
  }

  static getMatchById(matches, matchId) {
    return matches.find(m => m.id === matchId) || null;
  }
}
