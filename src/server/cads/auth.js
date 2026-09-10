/** @import { Request, ResponseToolkit } from '@hapi/hapi' */
import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants/status-codes.js'

const API_KEY_HEADER = 'x-api-key'
const STRATEGY_NAME = 'cads'

// Mirrors the shape ASP.NET returns for an unauthenticated request against the
// real cads-data-service (RFC 7807 ProblemDetails).
function unauthorized(h) {
  return h
    .response({
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.2',
      title: 'Unauthorized',
      status: statusCodes.unauthorized,
      detail: `A valid ${API_KEY_HEADER} header is required.`
    })
    .code(statusCodes.unauthorized)
    .takeover()
}

/**
 * Mirrors the real cads-data-service ApiKeyOrCognito auth policy, reduced to the
 * api-key path: a valid x-api-key header is required.
 *
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @returns {ReturnType<ResponseToolkit['authenticated']> | ReturnType<ResponseToolkit['response']>}
 */
function authenticate(request, h) {
  const apiKey = request.headers[API_KEY_HEADER]

  if (!apiKey || apiKey !== config.get('cads.apiKey')) {
    return unauthorized(h)
  }

  return h.authenticated({ credentials: {} })
}

// A Hapi auth provider: routes opt in with `options: { auth: 'cads' }` rather
// than each wiring up the header check themselves.
export const cadsAuth = {
  plugin: {
    name: 'cads-auth',
    register(server) {
      server.auth.scheme(STRATEGY_NAME, () => ({ authenticate }))
      server.auth.strategy(STRATEGY_NAME, STRATEGY_NAME)
    }
  }
}

export const AUTH_STRATEGY = STRATEGY_NAME
