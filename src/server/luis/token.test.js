import { createHmac } from 'node:crypto'
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import { config } from '../../config/config.js'
import { createToken, verifyToken } from './token.js'

const configValues = { 'luis.tokenSecret': 'test-secret' }
const NOW = new Date('2026-11-20T10:00:00Z')

const mocks = {
  configGet: vi.spyOn(config, 'get')
}

function decodePayload(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
}

describe('luis token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('it creates an HS256 token with the expected claims', () => {
    // Arrange
    const expectedExp = Math.floor(NOW.getTime() / 1000) + 30 * 60

    // Act
    const token = createToken({ userId: 'user', callerId: 'caller' })

    // Assert
    expect(JSON.parse(Buffer.from(token.split('.')[0], 'base64url'))).toEqual({
      alg: 'HS256',
      typ: 'JWT'
    })
    expect(decodePayload(token)).toEqual({
      UserId: 'user',
      Role: 'HSA',
      CallerId: 'caller',
      exp: expectedExp,
      iss: 'Luis',
      aud: 'Luis'
    })
  })

  test('it verifies a token it created', () => {
    // Arrange
    const token = createToken({ userId: 'user', callerId: 'caller' })

    // Act
    const claims = verifyToken(token)

    // Assert
    expect(claims.UserId).toBe('user')
  })

  test('it rejects a token with a tampered payload', () => {
    // Arrange
    const [header, , signature] = createToken({
      userId: 'user',
      callerId: 'caller'
    }).split('.')
    const forged = Buffer.from(JSON.stringify({ exp: 9999999999 })).toString(
      'base64url'
    )

    // Act
    const claims = verifyToken(`${header}.${forged}.${signature}`)

    // Assert
    expect(claims).toBeUndefined()
  })

  test('it rejects a token that is not three segments', () => {
    // Act
    const claims = verifyToken('not-a-token')

    // Assert
    expect(claims).toBeUndefined()
  })

  test('it rejects an expired token', () => {
    // Arrange
    const token = createToken({ userId: 'user', callerId: 'caller' })
    vi.setSystemTime(new Date(NOW.getTime() + 31 * 60 * 1000))

    // Act
    const claims = verifyToken(token)

    // Assert
    expect(claims).toBeUndefined()
  })

  test('it rejects a correctly signed token whose payload is not JSON', () => {
    // Arrange
    const header = Buffer.from('{"alg":"HS256"}').toString('base64url')
    const payload = Buffer.from('not json').toString('base64url')
    const signature = createHmac('sha256', 'test-secret')
      .update(`${header}.${payload}`)
      .digest('base64url')

    // Act
    const claims = verifyToken(`${header}.${payload}.${signature}`)

    // Assert
    expect(claims).toBeUndefined()
  })
})
