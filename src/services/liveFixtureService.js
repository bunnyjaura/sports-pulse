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

    // 1. Calculate date range starting from yesterday (to cover current matchday window across timezones)
    const now = new Date();
    const cutoffTime = now.getTime() - (24 * 3600 * 1000); // 24 hours window for active/upcoming
    const yesterday = new Date(cutoffTime);
    
    const formatDate = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}${mm}${dd}`;
    };
    
    const startStr = formatDate(yesterday);
    const futureDate = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const endStr = formatDate(futureDate);

    // 2. Primary Source: ESPN Scoreboards API
    for (const key of leagueKeys) {
      const lg = SUPPORTED_LEAGUES[key];
      if (!lg) continue;

      let slugsToTry = Array.isArray(lg.espnSlug) ? [...lg.espnSlug] : [lg.espnSlug];
      if (key === 'UEFA_CL') slugsToTry = ['uefa.champions', 'uefa.champions_qual'];
      else if (key === 'UEFA_EL') slugsToTry = ['uefa.europa', 'uefa.europa_qual'];
      else if (key === 'UEFA_ECL') slugsToTry = ['uefa.europa.conference', 'uefa.conference_qual', 'uefa.europa_conference'];

      for (const slug of slugsToTry) {
        try {
          const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${startStr}-${endStr}`;
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

    // 3. Secondary Fallback Source: TheSportsDB (if ESPN returned zero fixtures for a league)
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

    // Strictly keep only current and future fixtures (kickoffAt within active matchday window)
    const upcomingFixtures = cleanFixtures.filter(f => {
      const kickoffTime = new Date(f.kickoffAt).getTime();
      return !isNaN(kickoffTime) && kickoffTime >= cutoffTime;
    });

    // Sort chronologically by kickoff timestamp
    upcomingFixtures.sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());

    return {
      fixtures: upcomingFixtures,
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
