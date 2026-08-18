/**
 * Canonical Date & Kickoff Normalizer (Step 20)
 * Standardizes all date representations to ISO 8601 UTC strings and numerical timestamps (ms).
 * Invariant: training.kickoffAtMs < target.kickoffAtMs
 */

/**
 * Parses any raw date input into standard ISO string and numerical timestamp.
 * @param {string|Date|number} rawDate 
 * @returns {{ isoString: string, timestampMs: number, isValid: boolean }}
 */
export function normalizeKickoffDate(rawDate) {
  if (!rawDate) return { isoString: '', timestampMs: 0, isValid: false };

  let d = null;
  if (typeof rawDate === 'number') {
    d = new Date(rawDate);
  } else if (rawDate instanceof Date) {
    d = rawDate;
  } else if (typeof rawDate === 'string') {
    const trimmed = rawDate.trim();
    // Handle DD/MM/YYYY
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        d = new Date(Date.UTC(year, month, day));
      }
    }
    if (!d || isNaN(d.getTime())) {
      d = new Date(trimmed);
    }
  }

  if (!d || isNaN(d.getTime())) {
    return { isoString: '', timestampMs: 0, isValid: false };
  }

  const timestampMs = d.getTime();
  const isoString = d.toISOString();

  return {
    isoString,
    timestampMs,
    isValid: true
  };
}

/**
 * Strictly compares two kickoff dates numerically.
 * @param {string|Date|number} dateA 
 * @param {string|Date|number} dateB 
 * @returns {boolean} True if dateA is strictly prior to dateB (dateA < dateB)
 */
export function isStrictlyBefore(dateA, dateB) {
  const normA = normalizeKickoffDate(dateA);
  const normB = normalizeKickoffDate(dateB);
  if (!normA.isValid || !normB.isValid) return false;
  return normA.timestampMs < normB.timestampMs;
}
