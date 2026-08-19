/**
 * Canonical Fixture Schema & Normalizer
 * Converts raw API responses (ESPN, TheSportsDB) into a single internal representation.
 */

export const SUPPORTED_LEAGUES = {
  'ENG_PL': { id: 'ENG_PL', name: 'Premier League', country: 'England', espnSlug: 'eng.1', sportsDbId: '4328' },
  'ESP_LALIGA': { id: 'ESP_LALIGA', name: 'La Liga', country: 'Spain', espnSlug: 'esp.1', sportsDbId: '4380' },
  'ITA_SERIEA': { id: 'ITA_SERIEA', name: 'Serie A', country: 'Italy', espnSlug: 'ita.1', sportsDbId: '4331' },
  'GER_BUNDESLIGA': { id: 'GER_BUNDESLIGA', name: 'Bundesliga', country: 'Germany', espnSlug: 'ger.1', sportsDbId: '4332' },
  'FRA_LIGUE1': { id: 'FRA_LIGUE1', name: 'Ligue 1', country: 'France', espnSlug: 'fra.1', sportsDbId: '4334' },
  'ENG_CHAMPIONSHIP': { id: 'ENG_CHAMPIONSHIP', name: 'EFL Championship', country: 'England', espnSlug: 'eng.2', sportsDbId: '4329' },
  'NED_EREDIVISIE': { id: 'NED_EREDIVISIE', name: 'Dutch Eredivisie', country: 'Netherlands', espnSlug: 'ned.1', sportsDbId: '4337' },
  'POR_PRIMEIRA': { id: 'POR_PRIMEIRA', name: 'Primeira Liga', country: 'Portugal', espnSlug: 'por.1', sportsDbId: '4344' },
  'USA_MLS': { id: 'USA_MLS', name: 'Major League Soccer', country: 'USA', espnSlug: 'usa.1', sportsDbId: '4346' },
  'KSA_PRO': { id: 'KSA_PRO', name: 'Saudi Pro League', country: 'Saudi Arabia', espnSlug: 'ksa.1', sportsDbId: '4667' },
  'UEFA_CL': { id: 'UEFA_CL', name: 'UEFA Champions League', country: 'Europe', espnSlug: 'uefa.champions', sportsDbId: '4387' },
  'UEFA_EL': { id: 'UEFA_EL', name: 'UEFA Europa League', country: 'Europe', espnSlug: 'uefa.europa', sportsDbId: '4388' },
  'UEFA_ECL': { id: 'UEFA_ECL', name: 'UEFA Conference League', country: 'Europe', espnSlug: 'uefa.europa.conference', sportsDbId: '4480' },
  'UEFA_NATIONS': { id: 'UEFA_NATIONS', name: 'UEFA Nations League', country: 'Europe', espnSlug: 'uefa.nations', sportsDbId: '4442' },
  'CONMEBOL_LIBERTADORES': { id: 'CONMEBOL_LIBERTADORES', name: 'Copa Libertadores', country: 'South America', espnSlug: 'conmebol.libertadores', sportsDbId: '4482' },
  'CONMEBOL_SUDAMERICANA': { id: 'CONMEBOL_SUDAMERICANA', name: 'Copa Sudamericana', country: 'South America', espnSlug: 'conmebol.sudamericana', sportsDbId: '4483' },
  'AUS_CUP': { id: 'AUS_CUP', name: 'Australia Cup', country: 'Australia', espnSlug: 'aus.cup', sportsDbId: '4426' },
  'AUS_ALEAGUE': { id: 'AUS_ALEAGUE', name: 'Australia A-League', country: 'Australia', espnSlug: 'aus.1', sportsDbId: '4356' },
  'CHN_CSL': { id: 'CHN_CSL', name: 'Chinese Football Super League', country: 'China', espnSlug: 'chn.1', sportsDbId: '4353' },
  'AFF_CHAMPIONSHIP': { id: 'AFF_CHAMPIONSHIP', name: 'AFF Championship', country: 'Southeast Asia', espnSlug: 'aff.championship', sportsDbId: '4445' }
};

/**
 * Normalizes ESPN API event JSON into canonical Fixture schema
 */
export function normalizeEspnEvent(event, leagueKey) {
  if (!event || !event.competitions || !event.competitions[0]) return null;

  const comp = event.competitions[0];
  const competitors = comp.competitors || [];
  const homeComp = competitors.find(c => c.homeAway === 'home') || competitors[0];
  const awayComp = competitors.find(c => c.homeAway === 'away') || competitors[1];

  if (!homeComp || !awayComp || !homeComp.team || !awayComp.team) return null;

  const leagueInfo = SUPPORTED_LEAGUES[leagueKey] || {
    id: leagueKey || 'UNKNOWN',
    name: event.season?.name || 'Football Competition',
    country: 'Global'
  };

  const statusType = event.status?.type?.name || 'STATUS_SCHEDULED';
  const statusCode = mapEspnStatus(statusType);

  // Extract real market odds if available
  let market = null;
  if (comp.odds && comp.odds[0]) {
    const o = comp.odds[0];
    if (o.homeTeamOdds && o.awayTeamOdds) {
      market = {
        home: parseFloat(o.homeTeamOdds.summary || o.homeTeamOdds.value) || null,
        draw: parseFloat(o.drawOdds?.summary || o.drawOdds?.value) || null,
        away: parseFloat(o.awayTeamOdds.summary || o.awayTeamOdds.value) || null
      };
    }
  }

  const kickoffAt = event.date || comp.date;

  return {
    fixtureId: `espn-${event.id}`,
    league: leagueInfo,
    homeTeam: {
      id: homeComp.team.id,
      name: homeComp.team.displayName || homeComp.team.name,
      logo: homeComp.team.logo
    },
    awayTeam: {
      id: awayComp.team.id,
      name: awayComp.team.displayName || awayComp.team.name,
      logo: awayComp.team.logo
    },
    kickoffAt: new Date(kickoffAt).toISOString(),
    status: statusCode,
    score: (homeComp.score !== undefined && awayComp.score !== undefined) ? {
      home: parseInt(homeComp.score, 10) || 0,
      away: parseInt(awayComp.score, 10) || 0
    } : null,
    market: market,
    source: 'ESPN',
    fetchedAt: new Date().toISOString()
  };
}

/**
 * Normalizes TheSportsDB event JSON into canonical Fixture schema
 */
export function normalizeSportsDbEvent(evt, leagueKey) {
  if (!evt || !evt.strHomeTeam || !evt.strAwayTeam) return null;

  const leagueInfo = SUPPORTED_LEAGUES[leagueKey] || {
    id: leagueKey || 'UNKNOWN',
    name: evt.strLeague || 'Football Competition',
    country: 'Global'
  };

  const dateStr = evt.dateEvent;
  const timeStr = evt.strTime || '19:00:00';
  const kickoffIso = new Date(`${dateStr}T${timeStr.split('+')[0]}Z`).toISOString();

  return {
    fixtureId: `sdb-${evt.idEvent}`,
    league: leagueInfo,
    homeTeam: {
      id: evt.idHomeTeam || `h-${evt.strHomeTeam}`,
      name: evt.strHomeTeam,
      logo: evt.strHomeTeamBadge
    },
    awayTeam: {
      id: evt.idAwayTeam || `a-${evt.strAwayTeam}`,
      name: evt.strAwayTeam,
      logo: evt.strAwayTeamBadge
    },
    kickoffAt: kickoffIso,
    status: 'UPCOMING',
    score: null,
    market: null, // Zero odds from TheSportsDB free tier
    source: 'TheSportsDB',
    fetchedAt: new Date().toISOString()
  };
}

function mapEspnStatus(typeStr) {
  switch (typeStr) {
    case 'STATUS_IN_PROGRESS': return 'LIVE';
    case 'STATUS_HALFTIME': return 'HALFTIME';
    case 'STATUS_FINAL':
    case 'STATUS_FULL_TIME': return 'COMPLETED';
    case 'STATUS_POSTPONED': return 'POSTPONED';
    case 'STATUS_CANCELLED': return 'CANCELLED';
    default: return 'UPCOMING';
  }
}
