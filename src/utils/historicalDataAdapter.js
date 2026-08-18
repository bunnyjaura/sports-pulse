/**
 * Dataset Schema Adapter (Step 28 - Step 30)
 * Normalizes raw match records into a canonical schema so all feature engines
 * consume standardized field names (matchId, kickoffAtMs, homeTeamId, awayTeamId, homeTeamName, awayTeamName, competitionId, season, homeScore, awayScore).
 * Supports all dataset schemas including CSV headers (HomeTeam, AwayTeam, Date, FTHG, FTAG, FTR, Div).
 */

import { normalizeKickoffDate } from './dateNormalizer';
import { normalizeTeamName } from './teamNormalizer';

export function normalizeHistoricalMatch(rawMatch = {}) {
  if (!rawMatch) return null;

  const rawHome = rawMatch.homeTeam || rawMatch.homeTeamName || rawMatch.HomeTeam || '';
  const rawAway = rawMatch.awayTeam || rawMatch.awayTeamName || rawMatch.AwayTeam || '';
  const rawDate = rawMatch.kickoffAt || rawMatch.date || rawMatch.Date || '';

  const homeTeamName = normalizeTeamName(rawHome);
  const awayTeamName = normalizeTeamName(rawAway);

  const kickoffNorm = normalizeKickoffDate(rawDate);
  const kickoffAtMs = kickoffNorm.isValid ? kickoffNorm.timestampMs : 0;
  const kickoffIso = kickoffNorm.isValid ? kickoffNorm.isoString : (rawDate || new Date().toISOString());

  const matchId = rawMatch.id || rawMatch.matchId || `${homeTeamName}_${awayTeamName}_${kickoffIso.split('T')[0]}`;

  const homeTeamId = rawMatch.homeTeamId || homeTeamName.toLowerCase().replace(/\s+/g, '_');
  const awayTeamId = rawMatch.awayTeamId || awayTeamName.toLowerCase().replace(/\s+/g, '_');

  const homeScore = rawMatch.FTHG !== undefined ? Number(rawMatch.FTHG) : (rawMatch.homeGoals !== undefined ? Number(rawMatch.homeGoals) : 0);
  const awayScore = rawMatch.FTAG !== undefined ? Number(rawMatch.FTAG) : (rawMatch.awayGoals !== undefined ? Number(rawMatch.awayGoals) : 0);
  const ftr = rawMatch.FTR || (homeScore > awayScore ? 'H' : (awayScore > homeScore ? 'A' : 'D'));

  const competitionId = rawMatch.leagueId || rawMatch.league || rawMatch.Div || 'ENG_PL';
  const season = rawMatch.season || '2024-25';

  return {
    matchId,
    kickoffAtMs,
    kickoffIso,
    homeTeamId,
    awayTeamId,
    homeTeamName,
    awayTeamName,
    homeScore,
    awayScore,
    ftr,
    competitionId,
    season,
    raw: rawMatch
  };
}
