/**
 * Canonical Team Normalizer (Step 20)
 * Normalizes team names and known aliases deterministically before fixture matching.
 */

export const TEAM_ALIAS_MAP = {
  'ath madrid': 'Atletico Madrid',
  'atlético madrid': 'Atletico Madrid',
  'atletico madrid': 'Atletico Madrid',
  'atletico de madrid': 'Atletico Madrid',
  'ath bilbao': 'Athletic Bilbao',
  'athletic bilbao': 'Athletic Bilbao',
  'man united': 'Manchester United',
  'man utd': 'Manchester United',
  'manchester utd': 'Manchester United',
  'man city': 'Manchester City',
  'manchester city': 'Manchester City',
  'nott\'m forest': 'Nottingham Forest',
  'notts forest': 'Nottingham Forest',
  'nottingham forest': 'Nottingham Forest',
  'spurs': 'Tottenham',
  'tottenham hotspur': 'Tottenham',
  'west bromwich albion': 'West Brom',
  'west brom': 'West Brom',
  'wolverhampton wanderers': 'Wolves',
  'wolves': 'Wolves',
  'brighton & hove albion': 'Brighton',
  'brighton': 'Brighton',
  'paris sg': 'Paris Saint-Germain',
  'psg': 'Paris Saint-Germain',
  'paris saint germain': 'Paris Saint-Germain',
  'bayern munich': 'Bayern Munich',
  'bayern munchen': 'Bayern Munich',
  'bayer leverkusen': 'Leverkusen',
  'leverkusen': 'Leverkusen'
};

/**
 * Returns canonical team name for any input team name string.
 * @param {string} rawName 
 * @returns {string}
 */
export function normalizeTeamName(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';
  const trimmed = rawName.trim();
  const lower = trimmed.toLowerCase();
  return TEAM_ALIAS_MAP[lower] || trimmed;
}
