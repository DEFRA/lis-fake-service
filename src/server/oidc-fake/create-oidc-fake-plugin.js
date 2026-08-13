import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { statusCodes } from '../common/constants/status-codes.js'

const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
// In-memory authorization code store, 10-minute TTL — codes are single-use and
// short-lived by design, no persistence needed across restarts.
const CODE_TTL_MINUTES = 10
const CODE_TTL_MS = CODE_TTL_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND
const TOKEN_TTL_SECONDS = 3600
const AUTH_CODE_BYTE_LENGTH = 32
const BASIC_AUTH_PREFIX = 'Basic '
const RSA_MODULUS_LENGTH = 2048

function signJwt(payload, { privateKey, keyId }) {
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyId })
  ).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signing = `${header}.${body}`
  const signature = crypto
    .createSign('sha256')
    .update(signing)
    .sign(privateKey, 'base64url')
  return `${signing}.${signature}`
}

function verifyPkceS256(verifier, challenge) {
  const digest = crypto.createHash('sha256').update(verifier).digest()
  return Buffer.from(digest).toString('base64url') === challenge
}

function getClientId(request) {
  const auth = request.headers.authorization
  if (auth?.startsWith(BASIC_AUTH_PREFIX)) {
    const decoded = Buffer.from(
      auth.slice(BASIC_AUTH_PREFIX.length),
      'base64'
    ).toString()
    return decoded.split(':')[0]
  }
  return request.payload?.client_id ?? 'fake-client'
}

// Encapsulates the pending authorization-code map and its TTL/single-use semantics.
function createCodeStore() {
  const pendingCodes = new Map()

  return {
    storeCode(code, data) {
      pendingCodes.set(code, { ...data, expiresAt: Date.now() + CODE_TTL_MS })
    },
    redeemCode(code) {
      const entry = pendingCodes.get(code)
      pendingCodes.delete(code)
      if (!entry || Date.now() > entry.expiresAt) {
        return null
      }
      return entry
    }
  }
}

function buildUserItems(users, selectedEmail) {
  return Object.keys(users).map((email, index) => ({
    value: email,
    text: `${users[email].name} (${email})`,
    hint: users[email].description
      ? { text: users[email].description }
      : undefined,
    checked: selectedEmail ? email === selectedEmail : index === 0
  }))
}

function createDiscoveryHandler({ getExternalBase, getInternalBase }) {
  return function discoveryHandler(_request, h) {
    const ext = getExternalBase()
    const int = getInternalBase()
    return h
      .response({
        issuer: int,
        authorization_endpoint: `${ext}/authorize`,
        token_endpoint: `${int}/token`,
        jwks_uri: `${int}/jwks`,
        end_session_endpoint: `${ext}/logout`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        token_endpoint_auth_methods_supported: [
          'client_secret_basic',
          'client_secret_post',
          'none'
        ],
        scopes_supported: ['openid', 'offline_access', 'email', 'profile'],
        claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat', 'nonce', 'email']
      })
      .type('application/json')
  }
}

function logoutHandler(request, h) {
  const { post_logout_redirect_uri: postLogoutRedirectUri } = request.query

  if (postLogoutRedirectUri) {
    return h.redirect(postLogoutRedirectUri)
  }

  return h.response().code(statusCodes.noContent)
}

function createJwksHandler({ publicKey, keyId }) {
  return function jwksHandler(_request, h) {
    const jwk = publicKey.export({ format: 'jwk' })
    return h
      .response({ keys: [{ ...jwk, use: 'sig', alg: 'RS256', kid: keyId }] })
      .type('application/json')
  }
}

function createAuthorizeGetHandler({ label, users }) {
  return function authorizeGetHandler(request, h) {
    const {
      state,
      nonce,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod
    } = request.query
    return h.view('oidc-fake/login', {
      pageTitle: `Sign in — ${label}`,
      label,
      userItems: buildUserItems(users),
      state,
      nonce,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod
    })
  }
}

function createAuthorizePostHandler({ label, users, codeStore }) {
  return function authorizePostHandler(request, h) {
    const {
      email,
      state,
      nonce,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod
    } = request.payload

    const user = users[email]

    if (!user) {
      return h.view('oidc-fake/login', {
        pageTitle: `Sign in — ${label}`,
        label,
        userItems: buildUserItems(users, email),
        state,
        nonce,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        error: `No fixture user found with email ${email}`
      })
    }

    const code = crypto.randomBytes(AUTH_CODE_BYTE_LENGTH).toString('hex')
    codeStore.storeCode(code, {
      sub: user.sub,
      email,
      name: user.name,
      roles: user.roles ?? [],
      nonce,
      codeChallenge,
      codeChallengeMethod
    })

    const redirectUrl = new URL(redirectUri)
    redirectUrl.searchParams.set('code', code)
    redirectUrl.searchParams.set('state', state)
    return h.redirect(redirectUrl.href)
  }
}

function createTokenHandler({ getInternalBase, signingKey, codeStore }) {
  return function tokenHandler(request, h) {
    const {
      code,
      code_verifier: codeVerifier,
      grant_type: grantType
    } = request.payload

    if (grantType !== 'authorization_code') {
      return h
        .response({ error: 'unsupported_grant_type' })
        .type('application/json')
        .code(statusCodes.badRequest)
    }

    const entry = codeStore.redeemCode(code)
    if (!entry) {
      return h
        .response({
          error: 'invalid_grant',
          error_description: 'Unknown or expired code'
        })
        .type('application/json')
        .code(statusCodes.badRequest)
    }

    if (!verifyPkceS256(codeVerifier, entry.codeChallenge)) {
      return h
        .response({
          error: 'invalid_grant',
          error_description: 'PKCE verification failed'
        })
        .type('application/json')
        .code(statusCodes.badRequest)
    }

    const now = Math.floor(Date.now() / MS_PER_SECOND)
    const issuer = getInternalBase()
    const clientId = getClientId(request)

    const idToken = signJwt(
      {
        iss: issuer,
        sub: entry.sub,
        aud: clientId,
        iat: now,
        exp: now + TOKEN_TTL_SECONDS,
        nonce: entry.nonce,
        name: entry.name,
        email: entry.email,
        roles: entry.roles
      },
      signingKey
    )

    const accessToken = signJwt(
      {
        iss: issuer,
        sub: entry.sub,
        aud: clientId,
        iat: now,
        exp: now + TOKEN_TTL_SECONDS
      },
      signingKey
    )

    return h
      .response({
        access_token: accessToken,
        token_type: 'Bearer',
        id_token: idToken,
        expires_in: TOKEN_TTL_SECONDS
      })
      .type('application/json')
  }
}

function buildRoutes({ mountPath, handlers }) {
  const {
    discoveryHandler,
    jwksHandler,
    authorizeGetHandler,
    authorizePostHandler,
    tokenHandler
  } = handlers

  return [
    {
      method: 'GET',
      path: `${mountPath}/.well-known/openid-configuration`,
      options: { auth: false },
      handler: discoveryHandler
    },
    {
      method: 'GET',
      path: `${mountPath}/jwks`,
      options: { auth: false },
      handler: jwksHandler
    },
    {
      method: 'GET',
      path: `${mountPath}/logout`,
      options: { auth: false },
      handler: logoutHandler
    },
    {
      method: 'GET',
      path: `${mountPath}/authorize`,
      options: { auth: false },
      handler: authorizeGetHandler
    },
    {
      method: 'POST',
      path: `${mountPath}/authorize`,
      options: { auth: false },
      handler: authorizePostHandler
    },
    {
      method: 'POST',
      path: `${mountPath}/token`,
      options: { auth: false },
      handler: tokenHandler
    }
  ]
}

/**
 * Builds a fixture-backed, self-contained OIDC provider fake: discovery
 * document, JWKS, authorization-code + PKCE flow, RS256-signed tokens.
 *
 * @param {{
 *   name: string,
 *   label: string,
 *   mountPath: string,
 *   fixturePath: string,
 *   getExternalBase: () => string,
 *   getInternalBase: () => string
 * }} options
 * @returns {{ plugin: { name: string, register: Function } }}
 */
export function createOidcFakePlugin({
  name,
  label,
  mountPath,
  fixturePath,
  getExternalBase,
  getInternalBase
}) {
  const keyId = crypto.randomUUID()
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: RSA_MODULUS_LENGTH
  })
  const signingKey = { privateKey, keyId }
  const users = JSON.parse(readFileSync(fixturePath, 'utf-8'))
  const codeStore = createCodeStore()

  const discoveryHandler = createDiscoveryHandler({
    getExternalBase,
    getInternalBase
  })
  const jwksHandler = createJwksHandler({ publicKey, keyId })
  const authorizeGetHandler = createAuthorizeGetHandler({ label, users })
  const authorizePostHandler = createAuthorizePostHandler({
    label,
    users,
    codeStore
  })
  const tokenHandler = createTokenHandler({
    getInternalBase,
    signingKey,
    codeStore
  })

  return {
    plugin: {
      name,
      register(server) {
        server.route(
          buildRoutes({
            mountPath,
            handlers: {
              discoveryHandler,
              jwksHandler,
              authorizeGetHandler,
              authorizePostHandler,
              tokenHandler
            }
          })
        )
      }
    }
  }
}
