/** @import { Request, ResponseToolkit } from '@hapi/hapi' */
import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { problem } from './helpers/problem.js'

const AUTH_SCHEME = 'Basic'
const STRATEGY_NAME = 'krds'

// Mirrors the shape ASP.NET returns for an unauthenticated request against the
// real keeper-data-api (RFC 7807 ProblemDetails).
function unauthorized(h) {
  return problem(
    h,
    statusCodes.unauthorized,
    'Unauthorized',
    'A valid Authorization: Basic header is required.'
  ).takeover()
}

/**
 * Stands in for the real keeper-data-api's Bearer-or-Basic auth policy,
 * reduced to the Basic path: credentials arrive as
 * `Authorization: Basic base64(clientId:secret)` and are checked against the
 * single configured client.
 *
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @returns {ReturnType<ResponseToolkit['authenticated']> | ReturnType<ResponseToolkit['response']>}
 */
function authenticate(request, h) {
  const header = request.headers.authorization

  if (!header?.startsWith(`${AUTH_SCHEME} `)) {
    return unauthorized(h)
  }

  const encoded = header.slice(AUTH_SCHEME.length + 1)
  const [clientId, secret] = Buffer.from(encoded, 'base64')
    .toString('utf-8')
    .split(':')

  if (
    clientId !== config.get('krds.clientId') ||
    secret !== config.get('krds.clientSecret')
  ) {
    return unauthorized(h)
  }

  return h.authenticated({ credentials: { clientId } })
}

// A Hapi auth provider: routes opt in with `options: { auth: 'krds' }` rather
// than each wiring up the header check themselves.
export const krdsAuth = {
  plugin: {
    name: 'krds-auth',
    register(server) {
      server.auth.scheme(STRATEGY_NAME, () => ({ authenticate }))
      server.auth.strategy(STRATEGY_NAME, STRATEGY_NAME)
    }
  }
}

export const AUTH_STRATEGY = STRATEGY_NAME
