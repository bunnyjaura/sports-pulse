/**
 * League Relative Strength Engine (Step 21)
 * Computes competition relative strength coefficients across European competitions.
 */

const LEAGUE_COEFFICIENTS = {
  'ENG_PL': 1.00,
  'ESP_LALIGA': 0.98,
  'ITA_SERIEA': 0.94,
  'GER_BUNDESLIGA': 0.94,
  'FRA_LIGUE1': 0.88,
  'ENG_CHAMPIONSHIP': 0.85,
  'NED_EREDIVISIE': 0.86,
  'POR_PRIMEIRA': 0.87,
  'USA_MLS': 0.80,
  'KSA_PRO': 0.82,
  'UEFA_CL': 1.05,
  'UEFA_EL': 1.01,
  'UEFA_ECL': 0.96,
  'UEFA_NATIONS': 0.95,
  'CONMEBOL_LIBERTADORES': 0.92,
  'CONMEBOL_SUDAMERICANA': 0.88
};

export function computeLeagueStrength(leagueHome = 'ENG_PL', leagueAway = 'ENG_PL') {
  const coefHome = LEAGUE_COEFFICIENTS[leagueHome] || 1.00;
  const coefAway = LEAGUE_COEFFICIENTS[leagueAway] || 1.00;

  return {
    homeLeagueStrength: coefHome,
    awayLeagueStrength: coefAway,
    differential: coefHome - coefAway,
    status: 'AVAILABLE'
  };
}
