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
  'UEFA_CL': 1.05
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
