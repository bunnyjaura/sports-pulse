/**
 * Canonical Pre-Match Temporal Filter Helper (Step 25 - Step 30)
 * Enforces strict timestamp inequality: match.kickoffAtMs < targetMatch.kickoffAtMs (<, never <=).
 * Removes future matches and target match itself, sorts chronologically, and preserves provenance.
 * Supports all dataset date fields (kickoffAt, date, Date).
 */

import { normalizeKickoffDate } from './dateNormalizer';

export function getPreMatchMatches(matches = [], targetMatch = null, targetCutoff = null) {
  let targetKickoffMs = null;

  if (targetCutoff) {
    const norm = normalizeKickoffDate(targetCutoff);
    if (norm.isValid) targetKickoffMs = norm.timestampMs;
  } else if (targetMatch) {
    const norm = normalizeKickoffDate(targetMatch.kickoffAt || targetMatch.date || targetMatch.Date);
    if (norm.isValid) targetKickoffMs = norm.timestampMs;
  }

  if (!targetKickoffMs) {
    return [];
  }

  const targetId = targetMatch?.id || targetMatch?.matchId || null;

  return matches.filter(m => {
    // Exclude target match if matching ID
    if (targetId && (m.id === targetId || m.matchId === targetId)) return false;

    const mDateRaw = m.kickoffAt || m.date || m.Date;
    const mNorm = normalizeKickoffDate(mDateRaw);
    if (!mNorm.isValid) return false;

    // Strict pre-kickoff inequality: m.kickoffAtMs < target.kickoffAtMs
    return mNorm.timestampMs < targetKickoffMs;
  }).sort((a, b) => {
    const aNorm = normalizeKickoffDate(a.kickoffAt || a.date || a.Date);
    const bNorm = normalizeKickoffDate(b.kickoffAt || b.date || b.Date);
    const aMs = aNorm.isValid ? aNorm.timestampMs : 0;
    const bMs = bNorm.isValid ? bNorm.timestampMs : 0;
    return aMs - bMs;
  });
}
