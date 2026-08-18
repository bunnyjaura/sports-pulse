/**
 * Fixture Deduplicator & Validator
 * Enforces fixture uniqueness and rejects invalid / duplicate match entries.
 */

export function normalizeTeamName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/\b(fc|afc|cf|club|sc|vfb|ssv|sv)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function generateFixtureKey(fixture) {
  const leagueId = fixture.league?.id || 'GLOBAL';
  const h = normalizeTeamName(fixture.homeTeam?.name);
  const a = normalizeTeamName(fixture.awayTeam?.name);
  const dateStr = fixture.kickoffAt ? new Date(fixture.kickoffAt).toISOString().split('T')[0] : 'NODATE';
  return `${leagueId}:${h}_vs_${a}:${dateStr}`;
}

export function validateFixture(fixture) {
  if (!fixture || !fixture.homeTeam?.name || !fixture.awayTeam?.name) {
    return { valid: false, reason: 'Missing home or away team' };
  }

  const hNorm = normalizeTeamName(fixture.homeTeam.name);
  const aNorm = normalizeTeamName(fixture.awayTeam.name);

  if (!hNorm || !aNorm || hNorm === aNorm) {
    return { valid: false, reason: 'Invalid team matchup (Home == Away)' };
  }

  if (!fixture.kickoffAt || isNaN(new Date(fixture.kickoffAt).getTime())) {
    return { valid: false, reason: 'Missing or invalid kickoff timestamp' };
  }

  return { valid: true, reason: 'OK' };
}

/**
 * Deduplicates and validates an array of normalized fixtures
 * Source precedence: ESPN > TheSportsDB
 */
export function deduplicateFixtures(fixtures) {
  const seenKeys = new Set();
  const validFixtures = [];

  // Sort so ESPN sources come first if merging
  const sorted = [...fixtures].sort((a, b) => {
    if (a.source === 'ESPN' && b.source !== 'ESPN') return -1;
    if (a.source !== 'ESPN' && b.source === 'ESPN') return 1;
    return 0;
  });

  for (const fix of sorted) {
    const val = validateFixture(fix);
    if (!val.valid) continue;

    const key = generateFixtureKey(fix);
    if (seenKeys.has(key)) continue;

    seenKeys.add(key);
    validFixtures.push(fix);
  }

  return validFixtures;
}
