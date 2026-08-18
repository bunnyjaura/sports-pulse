/**
 * Common Opponent Engine (Step 25)
 * Evaluates performance differentials against shared common opponents (A vs C & B vs C).
 * Invariant: Uses getPreMatchMatches strictly to enforce match.kickoffAtMs < target.kickoffAtMs.
 */

import { normalizeTeamName } from './teamNormalizer';
import { getPreMatchMatches } from './preMatchFilter';

export function computeCommonOpponentEvidence(allMatches = [], homeTeam = '', awayTeam = '', kickoffAt = null, targetMatch = null) {
  const normHome = normalizeTeamName(homeTeam).toLowerCase();
  const normAway = normalizeTeamName(awayTeam).toLowerCase();

  if (!normHome || !normAway || normHome === normAway) {
    return { count: 0, homePtsAvg: 0, awayPtsAvg: 0, differential: 0, status: 'UNAVAILABLE' };
  }

  // Filter matches strictly prior to target kickoff
  const matches = getPreMatchMatches(allMatches, targetMatch, kickoffAt);
  if (matches.length === 0) {
    return { count: 0, homePtsAvg: 0, awayPtsAvg: 0, differential: 0, status: 'UNAVAILABLE' };
  }

  // Find all opponents faced by Home
  const homeOpponents = new Map();
  for (const m of matches) {
    const h = normalizeTeamName(m.homeTeam).toLowerCase();
    const a = normalizeTeamName(m.awayTeam).toLowerCase();
    const fthg = m.FTHG !== undefined ? m.FTHG : m.homeGoals;
    const ftag = m.FTAG !== undefined ? m.FTAG : m.awayGoals;
    const ftr = m.FTR || (fthg > ftag ? 'H' : (ftag > fthg ? 'A' : 'D'));

    if (h === normHome && a !== normAway) {
      const pts = ftr === 'H' ? 3 : (ftr === 'D' ? 1 : 0);
      if (!homeOpponents.has(a)) homeOpponents.set(a, []);
      homeOpponents.get(a).push(pts);
    } else if (a === normHome && h !== normAway) {
      const pts = ftr === 'A' ? 3 : (ftr === 'D' ? 1 : 0);
      if (!homeOpponents.has(h)) homeOpponents.set(h, []);
      homeOpponents.get(h).push(pts);
    }
  }

  // Find all opponents faced by Away that are also in homeOpponents
  const commonSet = new Set();
  const awayOpponents = new Map();

  for (const m of matches) {
    const h = normalizeTeamName(m.homeTeam).toLowerCase();
    const a = normalizeTeamName(m.awayTeam).toLowerCase();
    const fthg = m.FTHG !== undefined ? m.FTHG : m.homeGoals;
    const ftag = m.FTAG !== undefined ? m.FTAG : m.awayGoals;
    const ftr = m.FTR || (fthg > ftag ? 'H' : (ftag > fthg ? 'A' : 'D'));

    if (h === normAway && homeOpponents.has(a)) {
      const pts = ftr === 'H' ? 3 : (ftr === 'D' ? 1 : 0);
      if (!awayOpponents.has(a)) awayOpponents.set(a, []);
      awayOpponents.get(a).push(pts);
      commonSet.add(a);
    } else if (a === normAway && homeOpponents.has(h)) {
      const pts = ftr === 'A' ? 3 : (ftr === 'D' ? 1 : 0);
      if (!awayOpponents.has(h)) awayOpponents.set(h, []);
      awayOpponents.get(h).push(pts);
      commonSet.add(h);
    }
  }

  const commonList = Array.from(commonSet);
  if (commonList.length === 0) {
    return { count: 0, homePtsAvg: 0, awayPtsAvg: 0, differential: 0, status: 'UNAVAILABLE' };
  }

  let totalHomePts = 0;
  let totalAwayPts = 0;

  for (const opp of commonList) {
    const hList = homeOpponents.get(opp) || [];
    const aList = awayOpponents.get(opp) || [];

    if (hList.length > 0) totalHomePts += (hList.reduce((a, b) => a + b, 0) / hList.length);
    if (aList.length > 0) totalAwayPts += (aList.reduce((a, b) => a + b, 0) / aList.length);
  }

  const count = commonList.length;
  const homePtsAvg = totalHomePts / count;
  const awayPtsAvg = totalAwayPts / count;

  return {
    commonOpponents: commonList,
    count,
    homePtsAvg,
    awayPtsAvg,
    differential: homePtsAvg - awayPtsAvg,
    status: count > 0 ? 'AVAILABLE' : 'UNAVAILABLE'
  };
}
