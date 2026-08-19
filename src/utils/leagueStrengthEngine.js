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
  'CONMEBOL_SUDAMERICANA': 0.88,
  'ARG_PRIMERA': 0.88,
  'AUT_BUNDESLIGA': 0.82,
  'BEL_PRO_LEAGUE': 0.85,
  'BRA_SERIEA': 0.90,
  'COL_PRIMERA': 0.80,
  'DEN_SUPERLIGA': 0.82,
  'GER_2BUNDESLIGA': 0.83,
  'CONCACAF_LEAGUES_CUP': 0.82,
  'AFC_CL': 0.84,
  'JPN_J1': 0.81,
  'MEX_LIGAMX': 0.84,
  'NOR_ELITESERIEN': 0.80,
  'POL_EKSTRAKLASA': 0.79,
  'KOR_KLEAGUE1': 0.80,
  'SCO_PREMIERSHIP': 0.84,
  'ESP_LALIGA2': 0.83,
  'SWE_ALLSVENSKAN': 0.80,
  'SUI_SUPERLEAGUE': 0.83,
  'TUR_SUPERLIG': 0.85
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
