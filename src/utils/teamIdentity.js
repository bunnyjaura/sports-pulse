/**
 * Canonical Team Identity Resolver (Step 28)
 * Centralizes team identification and matching priority:
 *  1. Stable Team ID
 *  2. Canonical Team ID
 *  3. Explicit Alias Mapping
 *  4. Normalized Exact Name
 */

import { normalizeTeamName, TEAM_ALIAS_MAP } from './teamNormalizer';

export function getCanonicalTeamId(teamNameOrId = '') {
  if (!teamNameOrId || typeof teamNameOrId !== 'string') return '';
  const norm = normalizeTeamName(teamNameOrId);
  return norm.toLowerCase().replace(/[^a-z0-9\s_]/g, '').trim().replace(/\s+/g, '_');
}

export function resolveTeamIdentity(teamNameOrId = '') {
  const displayName = normalizeTeamName(teamNameOrId);
  const teamId = getCanonicalTeamId(teamNameOrId);
  return { teamId, displayName };
}


export function sameTeam(teamA = '', teamB = '') {
  const res = resolveTeamIdentityMatch(teamA, teamB);
  return res.matched;
}

export function resolveTeamIdentityMatch(teamA = '', teamB = '') {
  if (!teamA || !teamB) {
    return { matched: false, method: 'NONE', reason: 'EMPTY_INPUT' };
  }

  const normA = normalizeTeamName(teamA);
  const normB = normalizeTeamName(teamB);

  if (normA === normB) {
    return { matched: true, method: 'CANONICAL_NAME', canonicalName: normA };
  }

  const idA = getCanonicalTeamId(normA);
  const idB = getCanonicalTeamId(normB);

  if (idA === idB) {
    return { matched: true, method: 'TEAM_ID', canonicalId: idA };
  }

  const aliasA = TEAM_ALIAS_MAP[normA.toLowerCase()] || normA;
  const aliasB = TEAM_ALIAS_MAP[normB.toLowerCase()] || normB;

  if (aliasA.toLowerCase() === aliasB.toLowerCase()) {
    return { matched: true, method: 'ALIAS', canonicalName: aliasA };
  }

  return { matched: false, method: 'UNRESOLVED', reason: 'TEAM_ID_AND_NAME_UNRESOLVED' };
}
