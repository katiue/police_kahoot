/**
 * Lightweight nickname guard for event play.
 * - Trims, length-caps at 20 chars.
 * - Rejects empty / whitespace-only.
 * - Rejects substrings that match the case-insensitive denylist below.
 *
 * The denylist is intentionally small: enough to deter the common drive-by
 * troll picks at public events without pretending to be a real profanity
 * filter. Extend in-place as needed — order doesn't matter.
 */
const DENY_PARTS = [
  // English staples
  'fuck', 'shit', 'cunt', 'bitch', 'asshole', 'nigger', 'nigga', 'fag', 'slut',
  'whore', 'dick', 'cock', 'pussy', 'rape', 'nazi', 'hitler',
  // Vietnamese common
  'dmm', 'dcm', 'cailon', 'cailol', 'lon', 'cailol', 'cailoz', 'cailo',
  'duma', 'dume', 'duconcho', 'duconme', 'dumemay', 'dumay',
  'lon ', 'lol ', 'cu ', 'buoi ', 'cak ', 'cac',
  'damay', 'cmm', 'cmnl', 'vcl', 'vl',
  // moderation reservations
  'admin', 'host', 'system', 'server', 'moderator', 'cucanninh',
]

export interface NicknameCheck {
  ok: boolean
  cleaned: string
  reason?: string
}

/** Normalize + validate. `cleaned` is the trimmed/capped form if `ok` is true. */
export function checkNickname(raw: unknown): NicknameCheck {
  if (typeof raw !== 'string') {
    return { ok: false, cleaned: '', reason: 'Nickname required' }
  }
  const cleaned = raw.trim().slice(0, 20)
  if (!cleaned) {
    return { ok: false, cleaned: '', reason: 'Nickname required' }
  }
  if (cleaned.length < 2) {
    return { ok: false, cleaned, reason: 'Nickname too short' }
  }
  const lower = cleaned.toLowerCase().replace(/[\s._\-]+/g, '')
  for (const bad of DENY_PARTS) {
    const needle = bad.toLowerCase().replace(/[\s._\-]+/g, '')
    if (needle && lower.includes(needle)) {
      return { ok: false, cleaned, reason: 'Nickname không phù hợp' }
    }
  }
  return { ok: true, cleaned }
}
