import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import hapi from '@hapi/hapi'
import { nunjucksConfig } from '../../config/nunjucks/nunjucks.js'
import { createOidcFakePlugin } from './create-oidc-fake-plugin.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturePath = path.resolve(
  dirname,
  '../../../data/fixtures/defra-ci.json'
)

const EXTERNAL_BASE = 'https://localhost:3000/oidc-fake-test'
const INTERNAL_BASE = 'https://oidc-fake-test:3000/oidc-fake-test'

function decodeJwtPayload(jwt) {
  const [, body] = jwt.split('.')
  return JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'))
}

function pkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')
  return { codeVerifier, codeChallenge }
}

async function makeServer() {
  const server = hapi.server()
  await server.register([
    nunjucksConfig,
    createOidcFakePlugin({
      name: 'oidc-fake-test',
      label: 'Test IDP',
      mountPath: '/oidc-fake-test',
      fixturePath,
      getExternalBase: () => EXTERNAL_BASE,
      getInternalBase: () => INTERNAL_BASE
    })
  ])
  return server
}

describe('createOidcFakePlugin()', () => {
  test('it serves a discovery document derived from the external/internal base', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/oidc-fake-test/.well-known/openid-configuration'
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(
      expect.objectContaining({
        issuer: INTERNAL_BASE,
        authorization_endpoint: `${EXTERNAL_BASE}/authorize`,
        token_endpoint: `${INTERNAL_BASE}/token`,
        jwks_uri: `${INTERNAL_BASE}/jwks`,
        end_session_endpoint: `${EXTERNAL_BASE}/logout`
      })
    )
  })

  test('it serves the RSA public key as a JWK', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/oidc-fake-test/jwks'
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.keys).toHaveLength(1)
    expect(response.result.keys[0]).toEqual(
      expect.objectContaining({ kty: 'RSA', use: 'sig', alg: 'RS256' })
    )
  })

  test('it redirects to the post_logout_redirect_uri when provided', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/oidc-fake-test/logout?post_logout_redirect_uri=https://example.com/signed-out'
    })

    // Assert
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('https://example.com/signed-out')
  })

  test('it returns 204 from logout when no redirect uri is provided', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/oidc-fake-test/logout'
    })

    // Assert
    expect(response.statusCode).toBe(204)
  })

  test('it renders the sign-in page listing fixture users', async () => {
    // Arrange
    const server = await makeServer()
    const { codeChallenge } = pkcePair()

    // Act
    const response = await server.inject({
      method: 'GET',
      url:
        '/oidc-fake-test/authorize?state=state-1&nonce=nonce-1' +
        '&redirect_uri=https://example.com/callback' +
        `&code_challenge=${codeChallenge}&code_challenge_method=S256`
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result).toContain('Test IDP')
    expect(response.result).toContain('farmer@example.com')
  })

  test('it re-renders the sign-in page with an error for an unknown fixture email', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/oidc-fake-test/authorize',
      payload: {
        email: 'not-a-fixture-user@example.com',
        state: 'state-1',
        nonce: 'nonce-1',
        redirect_uri: 'https://example.com/callback',
        code_challenge: 'irrelevant',
        code_challenge_method: 'S256'
      }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result).toContain(
      'No fixture user found with email not-a-fixture-user@example.com'
    )
  })

  test('it redirects with a code and the original state for a known fixture email', async () => {
    // Arrange
    const server = await makeServer()
    const { codeChallenge } = pkcePair()

    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/oidc-fake-test/authorize',
      payload: {
        email: 'farmer@example.com',
        state: 'state-1',
        nonce: 'nonce-1',
        redirect_uri: 'https://example.com/callback',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      }
    })

    // Assert
    expect(response.statusCode).toBe(302)
    const redirectUrl = new URL(response.headers.location)
    expect(redirectUrl.origin + redirectUrl.pathname).toBe(
      'https://example.com/callback'
    )
    expect(redirectUrl.searchParams.get('state')).toBe('state-1')
    expect(redirectUrl.searchParams.get('code')).toBeTruthy()
  })

  test('it rejects a token request with an unsupported grant type', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/oidc-fake-test/token',
      payload: { grant_type: 'client_credentials' }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.error).toBe('unsupported_grant_type')
  })

  test('it rejects a token request with an unknown authorization code', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/oidc-fake-test/token',
      payload: {
        grant_type: 'authorization_code',
        code: 'not-a-real-code',
        code_verifier: 'whatever'
      }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.error).toBe('invalid_grant')
    expect(response.result.error_description).toBe('Unknown or expired code')
  })

  test('it rejects a token request whose code_verifier does not match the original code_challenge', async () => {
    // Arrange
    const server = await makeServer()
    const { codeChallenge } = pkcePair()
    const authorizeResponse = await server.inject({
      method: 'POST',
      url: '/oidc-fake-test/authorize',
      payload: {
        email: 'farmer@example.com',
        state: 'state-1',
        nonce: 'nonce-1',
        redirect_uri: 'https://example.com/callback',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      }
    })
    const code = new URL(authorizeResponse.headers.location).searchParams.get(
      'code'
    )

    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/oidc-fake-test/token',
      payload: {
        grant_type: 'authorization_code',
        code,
        code_verifier: 'the-wrong-verifier'
      }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.error).toBe('invalid_grant')
    expect(response.result.error_description).toBe('PKCE verification failed')
  })

  test('it exchanges a valid code and code_verifier for signed tokens', async () => {
    // Arrange
    const server = await makeServer()
    const { codeVerifier, codeChallenge } = pkcePair()
    const authorizeResponse = await server.inject({
      method: 'POST',
      url: '/oidc-fake-test/authorize',
      payload: {
        email: 'farmer@example.com',
        state: 'state-1',
        nonce: 'nonce-1',
        redirect_uri: 'https://example.com/callback',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      }
    })
    const code = new URL(authorizeResponse.headers.location).searchParams.get(
      'code'
    )

    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/oidc-fake-test/token',
      payload: {
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier
      }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.token_type).toBe('Bearer')
    expect(response.result.expires_in).toBe(3600)
    const idTokenClaims = decodeJwtPayload(response.result.id_token)
    expect(idTokenClaims).toEqual(
      expect.objectContaining({
        iss: INTERNAL_BASE,
        sub: '00000000-0000-0000-0000-000000000002',
        email: 'farmer@example.com',
        name: 'Test Farmer',
        nonce: 'nonce-1'
      })
    )
    const accessTokenClaims = decodeJwtPayload(response.result.access_token)
    expect(accessTokenClaims).toEqual(
      expect.objectContaining({
        iss: INTERNAL_BASE,
        sub: '00000000-0000-0000-0000-000000000002'
      })
    )
  })

  test('it redeems each authorization code only once', async () => {
    // Arrange
    const server = await makeServer()
    const { codeVerifier, codeChallenge } = pkcePair()
    const authorizeResponse = await server.inject({
      method: 'POST',
      url: '/oidc-fake-test/authorize',
      payload: {
        email: 'farmer@example.com',
        state: 'state-1',
        nonce: 'nonce-1',
        redirect_uri: 'https://example.com/callback',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      }
    })
    const code = new URL(authorizeResponse.headers.location).searchParams.get(
      'code'
    )
    const tokenPayload = {
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier
    }
    await server.inject({
      method: 'POST',
      url: '/oidc-fake-test/token',
      payload: tokenPayload
    })

    // Act
    const secondResponse = await server.inject({
      method: 'POST',
      url: '/oidc-fake-test/token',
      payload: tokenPayload
    })

    // Assert
    expect(secondResponse.statusCode).toBe(400)
    expect(secondResponse.result.error).toBe('invalid_grant')
  })
})
