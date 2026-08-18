/**
 * Real-Time Live Fixture Service
 * Primary Source: ESPN Public Scoreboard API
 * Secondary Source: TheSportsDB (Fallback only)
 * Zero Mock Data & Zero Fabricated Odds
 */

import { SUPPORTED_LEAGUES, normalizeEspnEvent, normalizeSportsDbEvent } from '../utils/fixtureNormalizer';
import { deduplicateFixtures } from '../utils/fixtureDeduplicator';

export class LiveFixtureService {
  /**
   * Fetches real live/upcoming fixtures for all supported major competitions
   */
  static async fetchUpcomingFixtures(options = {}) {
    const leagueKeys = options.leagueKey && options.leagueKey !== 'ALL' 
      ? [options.leagueKey] 
      : Object.keys(SUPPORTED_LEAGUES);

    let allRawFixtures = [];
    let isLiveApiAvailable = false;

    // 1. Primary Source: ESPN Scoreboards API
    for (const key of leagueKeys) {
      const lg = SUPPORTED_LEAGUES[key];
      if (!lg) continue;

      const slugsToTry = key === 'INT_FRIENDLY' ? ['club.friendly', 'global.friendly', 'intl.friendly'] : [lg.espnSlug];

      for (const slug of slugsToTry) {
        try {
          const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`;
          const res = await fetch(url);
          if (!res.ok) continue;

          const data = await res.json();
          if (data && data.events && Array.isArray(data.events)) {
            isLiveApiAvailable = true;
            for (const event of data.events) {
              const normalized = normalizeEspnEvent(event, key);
              if (normalized) allRawFixtures.push(normalized);
            }
          }
        } catch (err) {
          console.warn(`ESPN API fetch failed for ${lg.name} (${slug}):`, err);
        }
      }
    }

    // 2. Secondary Fallback Source: TheSportsDB (if ESPN returned zero fixtures for a league)
    if (allRawFixtures.length === 0) {
      for (const key of leagueKeys) {
        const lg = SUPPORTED_LEAGUES[key];
        if (!lg) continue;

        try {
          const url = `https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id=${lg.sportsDbId}`;
          const res = await fetch(url);
          if (!res.ok) continue;

          const data = await res.json();
          if (data && data.events && Array.isArray(data.events)) {
            isLiveApiAvailable = true;
            for (const evt of data.events) {
              const normalized = normalizeSportsDbEvent(evt, key);
              if (normalized) allRawFixtures.push(normalized);
            }
          }
        } catch (err) {
          console.warn(`TheSportsDB API fallback failed for ${lg.name}:`, err);
        }
      }
    }

    // Deduplicate and validate
    const cleanFixtures = deduplicateFixtures(allRawFixtures);

    // Sort chronologically by kickoff timestamp
    cleanFixtures.sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());

    return {
      fixtures: cleanFixtures,
      isLiveApiAvailable,
      fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Filters fixtures by league ID
   */
  static filterByLeague(fixtures, leagueId) {
    if (!leagueId || leagueId === 'ALL') return fixtures;
    return fixtures.filter(f => f.league?.id === leagueId);
  }
}
