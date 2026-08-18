// Dynamic Elo Rating Engine for Sports Teams
// Supports margin-of-victory multiplier and date-cutoff filtering

export const INITIAL_ELO = 1500;
export const DEFAULT_K_FACTOR = 32;
export const HOME_ADVANTAGE_ELO = 65;

export function parseMatchDate(dateStr) {
  if (!dateStr) return new Date(0);
  if (dateStr instanceof Date) return dateStr;

  // Handle YYYY-MM-DD
  if (typeof dateStr === 'string' && dateStr.includes('-')) {
    return new Date(dateStr);
  }

  // Handle DD/MM/YYYY or DD/MM/YY
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-indexed month
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      return new Date(year, month, day);
    }
  }

  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

export function calculateEloExpectation(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function updateEloRatings(homeRating, awayRating, homeGoals, awayGoals, options = {}) {
  const K = options.kFactor || DEFAULT_K_FACTOR;
  const homeAdv = options.homeAdvantage !== undefined ? options.homeAdvantage : HOME_ADVANTAGE_ELO;

  // Effective home rating with home advantage boost
  const effHomeRating = homeRating + homeAdv;
  const expectedHome = calculateEloExpectation(effHomeRating, awayRating);
  const expectedAway = 1 - expectedHome;

  let actualHome = 0.5;
  if (homeGoals > awayGoals) actualHome = 1.0;
  else if (homeGoals < awayGoals) actualHome = 0.0;
  const actualAway = 1 - actualHome;

  // Goal margin multiplier G
  const goalDiff = Math.abs(homeGoals - awayGoals);
  let marginMultiplier = 1.0;
  if (goalDiff === 2) marginMultiplier = 1.25;
  else if (goalDiff === 3) marginMultiplier = 1.5;
  else if (goalDiff >= 4) marginMultiplier = 1.75 + (goalDiff - 4) * 0.1;

  const homeEloDelta = Math.round(K * marginMultiplier * (actualHome - expectedHome));
  const awayEloDelta = Math.round(K * marginMultiplier * (actualAway - expectedAway));

  return {
    newHomeElo: homeRating + homeEloDelta,
    newAwayElo: awayRating + awayEloDelta,
    homeEloDelta,
    awayEloDelta,
    expectedHomeProb: expectedHome,
    expectedAwayProb: expectedAway
  };
}

export function computeEloDatabase(matches, cutoffDate = null) {
  const ratings = {};
  const cutoffTimestamp = cutoffDate ? parseMatchDate(cutoffDate).getTime() : null;

  // Sort matches chronologically using robust date parser
  const sortedMatches = [...matches].sort((a, b) => parseMatchDate(a.date).getTime() - parseMatchDate(b.date).getTime());

  for (const m of sortedMatches) {
    if (cutoffTimestamp && parseMatchDate(m.date).getTime() > cutoffTimestamp) {
      continue; // Strictly filter out future matches beyond cutoff
    }

    if (!ratings[m.homeTeam]) ratings[m.homeTeam] = INITIAL_ELO;
    if (!ratings[m.awayTeam]) ratings[m.awayTeam] = INITIAL_ELO;

    if (m.FTHG !== undefined && m.FTAG !== undefined) {
      const res = updateEloRatings(ratings[m.homeTeam], ratings[m.awayTeam], m.FTHG, m.FTAG);
      ratings[m.homeTeam] = res.newHomeElo;
      ratings[m.awayTeam] = res.newAwayElo;
    }
  }

  return ratings;
}
