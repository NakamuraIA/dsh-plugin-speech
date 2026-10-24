/** The Edge token: reference vectors, the five-minute window, and the socket URL. */
import { describe, expect, it } from 'vitest'
import { secMsGec, synthUrl, tokenInput } from '../src/providers/edge/gec.ts'

const VECTORS: readonly (readonly [number, string])[] = [
  // Both halves were taken from the reference implementation (`edge-tts`
  // `drm.generate_sec_ms_gec_v2`) for these exact instants; the service compares
  // the token bit for bit, so a regression here is a 403 in production.
  [1700000000500, '2CD23A2CA0B2595A-F3C846C370E05F9CC83ACC5F995C5F5D87A4D0F14CE8936A0F902E64099E38A2'],
  [1792867200000, '89D6EEE5FADA5845-5507A9546C661B7E88388A1668E3CF079B8149F4C9712547D904E22AD9A8E9C5'],
  [1792867499999, '89D6EEE5FADA5845-5507A9546C661B7E88388A1668E3CF079B8149F4C9712547D904E22AD9A8E9C5'],
  [1792867500000, '5B17BD8CCDBA18E1-513401B616B0D98A68DC9050EAFEEF4B87786491F001D4920C3710A347E9E13B'],
]

describe('Sec-MS-GEC token', () => {
  it.each(VECTORS)('matches the reference token at %d ms', (instant, expected) => {
    expect(secMsGec(instant)).toBe(expected)
  })

  it('rounds the input down to a five-minute window', () => {
    expect(tokenInput(1792867200000).toString()).toBe(tokenInput(1792867499999).toString())
    expect(tokenInput(1792867499999).toString()).not.toBe(tokenInput(1792867500000).toString())
  })

  it('formats the token as a sixteen-hex checksum and a sixty-four-hex digest', () => {
    expect(secMsGec(1700000000500)).toMatch(/^[0-9A-F]{16}-[0-9A-F]{64}$/)
  })

  it('signs the socket URL with the token, its version, and a dashless connection id', () => {
    const url = new URL(synthUrl(1700000000500))
    expect(url.protocol).toBe('wss:')
    expect(url.host).toBe('speech.platform.bing.com')
    expect(url.searchParams.get('Sec-MS-GEC')).toBe(secMsGec(1700000000500))
    expect(url.searchParams.get('Sec-MS-GEC-Version')).toBe('2-143.0.3650.75')
    expect(url.searchParams.get('TrustedClientToken')).toBe('6A5AA1D4EAFF4E9FB37E23D68491D6F4')
    expect(url.searchParams.get('ConnectionId')).toMatch(/^[0-9a-f]{32}$/)
  })

  it('mints a new connection id per request', () => {
    expect(new URL(synthUrl()).searchParams.get('ConnectionId')).not.toBe(
      new URL(synthUrl()).searchParams.get('ConnectionId'),
    )
  })
})
