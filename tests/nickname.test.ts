import { describe, it, expect } from 'vitest'
import { checkNickname } from '@/lib/nickname'

describe('checkNickname — type & length', () => {
  it('rejects non-string input', () => {
    expect(checkNickname(undefined).ok).toBe(false)
    expect(checkNickname(null).ok).toBe(false)
    expect(checkNickname(123).ok).toBe(false)
    expect(checkNickname({}).ok).toBe(false)
  })

  it('rejects empty / whitespace-only', () => {
    expect(checkNickname('').ok).toBe(false)
    expect(checkNickname('    ').ok).toBe(false)
    expect(checkNickname('\t\n').ok).toBe(false)
  })

  it('rejects too-short (1 char after trim)', () => {
    const r = checkNickname(' a ')
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/quá ngắn/)
  })

  it('accepts a 2-char minimum', () => {
    expect(checkNickname('ab').ok).toBe(true)
  })

  it('caps length at 20 chars', () => {
    const r = checkNickname('a'.repeat(50))
    expect(r.ok).toBe(true)
    expect(r.cleaned).toHaveLength(20)
  })

  it('trims before length-capping', () => {
    expect(checkNickname('   Bob   ').cleaned).toBe('Bob')
  })
})

describe('checkNickname — denylist', () => {
  it('rejects exact banned words (case-insensitive)', () => {
    expect(checkNickname('fuck').ok).toBe(false)
    expect(checkNickname('FUCK').ok).toBe(false)
    expect(checkNickname('Admin').ok).toBe(false)
  })

  it('rejects banned word as a substring', () => {
    expect(checkNickname('superadmin').ok).toBe(false)
    expect(checkNickname('xXshitXx').ok).toBe(false)
  })

  it('catches denylist terms split by spaces/punctuation (normalization)', () => {
    // normalization strips spaces, dots, underscores, hyphens before matching
    expect(checkNickname('a.d.m.i.n').ok).toBe(false)
    expect(checkNickname('f u c k').ok).toBe(false)
    expect(checkNickname('s-h-i-t').ok).toBe(false)
  })

  it('reports the moderation reason for banned names', () => {
    expect(checkNickname('host').reason).toMatch(/không phù hợp/)
  })

  it('accepts a clean ordinary nickname', () => {
    const r = checkNickname('PlayerOne')
    expect(r.ok).toBe(true)
    expect(r.cleaned).toBe('PlayerOne')
  })

  it('no longer false-flags innocent words embedding short denylist tokens', () => {
    // Two-tier denylist: short/ambiguous terms (lon, cac, cu, rape, cock, host…)
    // only match as standalone tokens, so these innocent names pass.
    expect(checkNickname('Melon').ok).toBe(true) // was caught by "lon"
    expect(checkNickname('Cactus').ok).toBe(true) // was caught by "cac"
    expect(checkNickname('Document').ok).toBe(true) // was caught by "cu"
    expect(checkNickname('Grape').ok).toBe(true) // "rape"
    expect(checkNickname('Peacock').ok).toBe(true) // "cock"
    expect(checkNickname('ghost').ok).toBe(true) // "host"
    expect(checkNickname('Vladimir').ok).toBe(true) // "vl"
  })

  it('still rejects short denylist terms when they stand alone', () => {
    expect(checkNickname('lon').ok).toBe(false)
    expect(checkNickname('host').ok).toBe(false)
    expect(checkNickname('cu').ok).toBe(false)
    expect(checkNickname('peacock cock').ok).toBe(false) // "cock" as its own token
  })
})
