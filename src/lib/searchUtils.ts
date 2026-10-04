/**
 * Utilities for diacritic-, accent-, and case-insensitive search and matching.
 * Handles Catalan and Spanish diacritics (à, á, è, é, í, ï, ò, ó, ú, ü, ç, ñ, ·)
 * as well as common transit prefixes (pl., st., av., etc.).
 */

export function normalizeSearchText(str?: string | null): string {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accent and cedilla combining marks (ç -> c, à -> a, etc.)
    .toLowerCase()
    .replace(/[·•]/g, '')            // punt volat / bullet
    .replace(/[-–—_]/g, ' ')         // hyphens and dashes to spaces
    .replace(/\bpl\.\s*/g, 'placa ')
    .replace(/\bav\.\s*/g, 'avinguda ')
    .replace(/\bst\.\s*/g, 'sant ')
    .replace(/\bsta\.\s*/g, 'santa ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Checks whether candidate string contains the query string,
 * ignoring accents, case, and punctuation.
 */
export function matchesSearch(candidate?: string | null, query?: string | null): boolean {
  if (!candidate) return false
  if (!query) return true
  const normCandidate = normalizeSearchText(candidate)
  const normQuery = normalizeSearchText(query)
  if (!normQuery) return true
  return normCandidate.includes(normQuery)
}

/**
 * Checks whether candidate string starts with the query string,
 * ignoring accents, case, and punctuation. Useful for priority ranking.
 */
export function startsWithSearch(candidate?: string | null, query?: string | null): boolean {
  if (!candidate) return false
  if (!query) return true
  const normCandidate = normalizeSearchText(candidate)
  const normQuery = normalizeSearchText(query)
  if (!normQuery) return true
  return normCandidate.startsWith(normQuery)
}
