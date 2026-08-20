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
  'leverkusen': 'Leverkusen',
  'malaga': 'Malaga',
  'málaga': 'Malaga',
  'lask': 'LASK Linz',
  'lask linz': 'LASK Linz',
  'shanghai sipg': 'Shanghai Port',
  'shanghai port fc': 'Shanghai Port',
  'melbourne city fc': 'Melbourne City',
  'al hilal': 'Al-Hilal',
  'al hilal sfc': 'Al-Hilal',
  'al nassr': 'Al-Nassr',
  'al nassr fc': 'Al-Nassr'
};

/**
 * Strips Unicode diacritics/accents from a string using NFD decomposition.
 * @param {string} str 
 * @returns {string}
 */
export function stripDiacritics(str) {
  if (!str || typeof str !== 'string') return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Returns canonical team name for any input team name string.
 * @param {string} rawName 
 * @returns {string}
 */
export function normalizeTeamName(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';
  const trimmed = rawName.trim();
  const unaccented = stripDiacritics(trimmed);
  const lowerUnaccented = unaccented.toLowerCase();
  const lowerRaw = trimmed.toLowerCase();
  return TEAM_ALIAS_MAP[lowerRaw] || TEAM_ALIAS_MAP[lowerUnaccented] || unaccented;
}
