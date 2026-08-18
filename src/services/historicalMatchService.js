/**
 * Historical Match Query Service (Step 20)
 * Uses canonical HistoricalDataService to load 16,100+ multi-league matches (2016-2026).
 * Strictly filters matches using numerical timestamp comparison: match.kickoffAtMs < target.kickoffAtMs
 */

import { HistoricalDataService } from './historicalDataService';
import { normalizeKickoffDate } from '../utils/dateNormalizer';
import { normalizeTeamName } from '../utils/teamNormalizer';
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
   * Retrieves team-level match history prior to target cutoff
   */
  static getTeamHistory(matches, teamName, cutoff) {
    const validMatches = this.getMatchesBefore(matches, cutoff);
    const norm = normalizeTeamName(teamName).toLowerCase();
    return validMatches.filter(m => 
      normalizeTeamName(m.homeTeam).toLowerCase() === norm || 
      normalizeTeamName(m.awayTeam).toLowerCase() === norm
    );
  }

  /**
   * Evaluates minimum training history sufficiency and generates complete pre-match diagnostics.
   */
  static evaluateDataSufficiency(trainingMatches, homeTeam, awayTeam, cutoff, allMatches = [], targetMatch = null) {
    const count = trainingMatches.length;
    const homeHist = this.getTeamHistory(trainingMatches, homeTeam, cutoff);
    const awayHist = this.getTeamHistory(trainingMatches, awayTeam, cutoff);

    const homeCount = homeHist.length;
    const awayCount = awayHist.length;

    let status = 'FULL_HISTORY';
    let isSufficient = true;

    if (count < 50) {
      status = 'INSUFFICIENT_HISTORY';
      isSufficient = false;
    } else if (count < 200) {
      status = 'LIMITED_HISTORY';
    } else if (count < 500) {
      status = 'MODERATE_HISTORY';
    }

    const diagnostics = targetMatch ? getPreMatchDiagnostics(allMatches, targetMatch) : null;

    return {
      status,
      isSufficient,
      trainingMatchCount: count,
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
