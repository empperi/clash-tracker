/**
 * Normalizes a clan tag: trims whitespace, replaces letter 'O' with '0',
 * converts to uppercase, and ensures it starts with '#'.
 */
export function normalizeClanTag(tag: string): string {
  let normalized = tag.trim().toUpperCase().replace(/O/g, '0');
  if (!normalized.startsWith('#')) {
    normalized = '#' + normalized;
  }
  return normalized;
}

/**
 * Validates if a tag follows Clash of Clans tag character rules.
 * Must start with '#' followed by only allowed characters (0, 2, 8, 9, P, Y, L, Q, G, R, J, C, U, V).
 */
export function validateClanTag(tag: string): boolean {
  if (!tag || tag.length < 2) {
    return false;
  }
  return /^#[0289PYLQGRJCUV]+$/.test(tag);
}

/**
 * Aliases for player tag normalization and validation, as player tags and clan tags
 * share the exact same character set and normalization rules in Clash of Clans.
 */
export const normalizePlayerTag = normalizeClanTag;
export const validatePlayerTag = validateClanTag;
