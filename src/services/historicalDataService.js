/**
 * Canonical Historical Data Service (Step 20 & Step 28)
 * Loads, normalizes, deduplicates, and sorts 19,600+ multi-league completed matches across 2016-2027 seasons.
 */

import rawMultiLeagueMatches from '../data/multiLeagueHistorical.json';
import rawSeason2025_26 from '../data/season2025_26Historical.json';
import rawSeason2026_27 from '../data/season2026_27Historical.json';
import { INITIAL_HISTORICAL_MATCHES } from '../data/historicalMatches';
import { normalizeTeamName } from '../utils/teamNormalizer';
import { normalizeKickoffDate } from '../utils/dateNormalizer';
import { getHistoricalDatasetDiagnostics } from '../utils/historicalDataDiagnostics';

function getSeasonFromKickoffDate(dateNorm) {
  if (!dateNorm || !dateNorm.isValid) return '2024-25';
  const d = new Date(dateNorm.timestampMs);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1; // 1-12
  if (month >= 7) {
    const nextYr = (year + 1) % 100;
    return `${year}-${nextYr < 10 ? '0' + nextYr : nextYr}`;
  } else {
    const prevYr = year - 1;
    const currYr = year % 100;
    return `${prevYr}-${currYr < 10 ? '0' + currYr : currYr}`;
  }
}

export class HistoricalDataService {
  static cachedResult = null;

  /**
   * Loads, validates, normalizes, deduplicates, and sorts full multi-season dataset.
   * @returns {{ matches: Array, diagnostics: Object }}
   */
  static loadDataset() {
    if (this.cachedResult) {
      return this.cachedResult;
    }

    const raw = (rawMultiLeagueMatches || [])
      .concat(rawSeason2025_26 || [])
      .concat(rawSeason2026_27 || [])
      .concat(INITIAL_HISTORICAL_MATCHES || []);

    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;

    const seenKeys = new Set();
    const processed = [];

    for (const r of raw) {
      // 1. Team Normalization
      const homeTeam = normalizeTeamName(r.homeTeam);
      const awayTeam = normalizeTeamName(r.awayTeam);
      if (!homeTeam || !awayTeam || homeTeam === awayTeam) {
        invalidRows++;
        continue;
      }

      // 2. Date Normalization
      const dateNorm = normalizeKickoffDate(r.kickoffAt || r.date);
      if (!dateNorm.isValid) {
        invalidRows++;
        continue;
      }

      // 3. Deduplication Key
      const leagueId = r.leagueId || 'ENG_PL';
      const dateStr = dateNorm.isoString.split('T')[0];
      const dedupKey = `${leagueId}-${homeTeam}-${awayTeam}-${dateStr}`;

      if (seenKeys.has(dedupKey)) {
        duplicateRows++;
        continue;
      }
      seenKeys.add(dedupKey);

      const calculatedSeason = r.season || getSeasonFromKickoffDate(dateNorm);
      const competitionType = r.competitionType || (leagueId === 'INT_FRIENDLY' || (r.leagueName && r.leagueName.includes('Friendly')) ? 'FRIENDLY' : 'COMPETITIVE_LEAGUE');
      const competitionName = r.competitionName || (competitionType === 'FRIENDLY' ? 'International Club Friendly' : (r.league || r.leagueName || 'Premier League'));

      validRows++;
      processed.push({
        id: r.id || dedupKey,
        leagueId,
        leagueName: competitionName,
        league: competitionName,
        competitionId: leagueId,
        competitionName,
        competitionType,
        season: calculatedSeason,
        homeTeam,
        awayTeam,
        kickoffAt: dateNorm.isoString,
        kickoffAtMs: dateNorm.timestampMs,
        date: dateNorm.isoString.split('T')[0],
        timeIST: r.timeIST || '07:30 PM IST',
        homeGoals: r.FTHG !== undefined ? r.FTHG : r.homeGoals,
        awayGoals: r.FTAG !== undefined ? r.FTAG : r.awayGoals,
        FTHG: r.FTHG !== undefined ? r.FTHG : r.homeGoals,
        FTAG: r.FTAG !== undefined ? r.FTAG : r.awayGoals,
        FTR: r.FTR || (r.homeGoals > r.awayGoals ? 'H' : (r.awayGoals > r.homeGoals ? 'A' : 'D')),
        completed: true,
        B365H: r.B365H || null,
        B365D: r.B365D || null,
        B365A: r.B365A || null
      });
    }

    // 4. Chronological Sort
    processed.sort((a, b) => a.kickoffAtMs - b.kickoffAtMs);

    const diagnostics = getHistoricalDatasetDiagnostics(processed);
    diagnostics.rawRows = raw.length;
    diagnostics.validRows = validRows;
    diagnostics.invalidRows = invalidRows;
    diagnostics.duplicateRows = duplicateRows;

    this.cachedResult = {
      matches: processed,
      diagnostics
    };

    return this.cachedResult;
  }
}

export function getHistoricalDataset() {
  return HistoricalDataService.loadDataset().matches;
}
