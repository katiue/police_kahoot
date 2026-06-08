/**
 * Lightweight nickname guard for event play.
 * - Trims, length-caps at 20 chars.
 * - Rejects empty / whitespace-only.
 * - Rejects names matching the case-insensitive denylist below.
 *
 * The denylist is intentionally small: enough to deter the common drive-by
 * troll picks at public events without pretending to be a real profanity
 * filter. Extend in-place as needed — order doesn't matter.
 *
 * Two tiers, because one matching rule can't serve both goals:
 *  - DENY_SUBSTRINGS: long, unambiguous terms. Matched anywhere after stripping
 *    separators, so split-bypass like "a.d.m.i.n" / "f u c k" is still caught.
 *  - DENY_WORDS: short or innocent-embedding terms (lon, cu, cac, rape, cock…).
 *    Matched ONLY as a standalone token, so "Melon", "Grape", "Peacock",
 *    "ghost", "badminton" are no longer false-flagged.
 */
const DENY_SUBSTRINGS = [
  // English staples — long enough that substring matching rarely hits real words
  'fuck', 'shit', 'cunt', 'bitch', 'asshole', 'nigger', 'nigga', 'slut',
  'whore', 'pussy', 'nazi', 'hitler',
  // Vietnamese common (multi-syllable, unambiguous)
  'cailon', 'cailol', 'cailoz', 'cailo',
  'duma', 'dume', 'duconcho', 'duconme', 'dumemay', 'dumay', 'damay',
  'cucanninh',
  // moderation reservations
  'admin', 'moderator',
]

const DENY_WORDS = [
  // English short/embedding terms — would false-positive as substrings
  'fag', 'dick', 'cock', 'rape',
  // Vietnamese short terms
  'lon', 'lol', 'cu', 'buoi', 'cak', 'cac',
  'vl', 'vcl', 'cmm', 'cmnl', 'dmm', 'dcm',
  // moderation reservations that embed in real words (ghost, hostel, server…)
  'host', 'system', 'server',
]

const SEPARATORS = /[\s._\-]+/g

export interface NicknameCheck {
  ok: boolean
  cleaned: string
  reason?: string
}

export function checkNickname(raw: unknown): NicknameCheck {
  if (typeof raw !== 'string') {
    return { ok: false, cleaned: '', reason: 'Vui lòng nhập biệt danh' }
  }
  const cleaned = raw.trim().slice(0, 20)
  if (!cleaned) {
    return { ok: false, cleaned: '', reason: 'Vui lòng nhập biệt danh' }
  }
  if (cleaned.length < 2) {
    return { ok: false, cleaned, reason: 'Biệt danh quá ngắn' }
  }

  const lower = cleaned.toLowerCase()
  // Separator-stripped form catches split-bypass (a.d.m.i.n -> admin).
  const collapsed = lower.replace(SEPARATORS, '')
  for (const bad of DENY_SUBSTRINGS) {
    if (collapsed.includes(bad)) {
      return { ok: false, cleaned, reason: 'Nickname không phù hợp' }
    }
  }

  // Token-level match for short/ambiguous terms — only a standalone word counts.
  const tokens = lower.split(SEPARATORS).filter(Boolean)
  for (const bad of DENY_WORDS) {
    if (tokens.includes(bad)) {
      return { ok: false, cleaned, reason: 'Nickname không phù hợp' }
    }
  }

  return { ok: true, cleaned }
}
