import { statusCodes } from '../common/constants/status-codes.js'
import { verifyToken } from './token.js'

/** @import { Server, Request, ResponseToolkit } from '@hapi/hapi' */

const STRATEGY_NAME = 'luis'
const BEARER_PREFIX = 'Bearer '

/**
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @returns {ReturnType<ResponseToolkit['authenticated']> | ReturnType<ResponseToolkit['response']>}
 */
function authenticate(request, h) {
  const header = request.headers.authorization
  const claims = header?.startsWith(BEARER_PREFIX)
    ? verifyToken(header.slice(BEARER_PREFIX.length))
    : undefined

  if (!claims) {
    return h.response().code(statusCodes.unauthorized).takeover()
  }

  return h.authenticated({ credentials: claims })
}

// A Hapi auth provider: routes opt in with `options: { auth: 'luis' }`.
export const luisAuth = {
  plugin: {
    name: `${STRATEGY_NAME}-auth`,
    /**
     * @param {Server} server
     */
    register(server) {
      server.auth.scheme(STRATEGY_NAME, () => ({ authenticate }))
      server.auth.strategy(STRATEGY_NAME, STRATEGY_NAME)
    }
  }
}

export const AUTH_STRATEGY = STRATEGY_NAME
