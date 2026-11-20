import { createHmac, timingSafeEqual } from 'node:crypto'

import { config } from '../../config/config.js'

const SECONDS_PER_MINUTE = 60
const TOKEN_LIFETIME_MINUTES = 30
const MILLISECONDS_PER_SECOND = 1000
const TOKEN_SEGMENT_COUNT = 3
const TOKEN_LIFETIME_SECONDS = TOKEN_LIFETIME_MINUTES * SECONDS_PER_MINUTE
const ISSUER = 'Luis'
const ROLE = 'HSA'
const HEADER = { alg: 'HS256', typ: 'JWT' }

/**
 * @typedef {object} TokenClaims
 * @property {string} [UserId]
 * @property {string} [Role]
 * @property {string} [CallerId]
 * @property {number} [exp]
 * @property {string} [iss]
 * @property {string} [aud]
 */

/**
 * @param {object} value
 * @returns {string} the value as base64url-encoded JSON
 */
function encodeSegment(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

/**
 * @param {string} signingInput
 * @returns {Buffer} the HS256 signature of the signing input
 */
function sign(signingInput) {
  return createHmac('sha256', config.get('luis.tokenSecret'))
    .update(signingInput)
    .digest()
}

/**
 * @param {{ userId: string, callerId: string }} claims
 * @returns {string} a signed HS256 JWT valid for 30 minutes
 */
export function createToken({ userId, callerId }) {
  const claims = {
    UserId: userId,
    Role: ROLE,
    CallerId: callerId,
    exp:
      Math.floor(Date.now() / MILLISECONDS_PER_SECOND) + TOKEN_LIFETIME_SECONDS,
    iss: ISSUER,
    aud: ISSUER
  }
  const signingInput = `${encodeSegment(HEADER)}.${encodeSegment(claims)}`

  return `${signingInput}.${sign(signingInput).toString('base64url')}`
}

/**
 * @param {string} signingInput
 * @param {string} signature - base64url signature to check
 * @returns {boolean} whether the signature matches, compared in constant time
 */
function hasValidSignature(signingInput, signature) {
  const expected = sign(signingInput)
  const actual = Buffer.from(signature, 'base64url')

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/**
 * @param {string} payloadSegment
 * @returns {TokenClaims | undefined} the decoded claims, or undefined if not JSON
 */
function decodeClaims(payloadSegment) {
  try {
    return JSON.parse(Buffer.from(payloadSegment, 'base64url').toString())
  } catch {
    return undefined
  }
}

/**
 * @param {string} token
 * @returns {TokenClaims | undefined} the token's claims when a signing secret
 *   is configured, its signature is valid and it has not expired, otherwise
 *   undefined
 */
export function verifyToken(token) {
  const segments = token.split('.')
  if (
    !config.get('luis.tokenSecret') ||
    segments.length !== TOKEN_SEGMENT_COUNT
  ) {
    return undefined
  }

  const [header, payload, signature] = segments
  if (!hasValidSignature(`${header}.${payload}`, signature)) {
    return undefined
  }

  const claims = decodeClaims(payload)
  const nowSeconds = Date.now() / MILLISECONDS_PER_SECOND
  return typeof claims?.exp === 'number' && claims.exp > nowSeconds
    ? claims
    : undefined
}
