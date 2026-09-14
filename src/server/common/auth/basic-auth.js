import { config } from '../../../config/config.js'
import { statusCodes } from '../constants/status-codes.js'
import { problem } from '../helpers/problem.js'

/** @import { Request, ResponseToolkit } from '@hapi/hapi' */

const AUTH_SCHEME = 'Basic'

// Mirrors the shape ASP.NET returns for an unauthenticated request against a
// real upstream (RFC 7807 ProblemDetails).
function unauthorized(h) {
  return problem(
    h,
    statusCodes.unauthorized,
    'Unauthorized',
    'A valid Authorization: Basic header is required.'
  ).takeover()
}

/**
 * Builds a Hapi auth provider standing in for an upstream's Basic/API-key
 * auth path: credentials arrive as `Authorization: Basic
 * base64(clientId:secret)` and are checked against a single configured
 * client, rather than a username/password store. Shared by /cads (the real
 * ApiKeyOrCognito policy's api-key path is registered under Basic's own auth
 * scheme) and /krds (standing in for the real Bearer-or-Basic policy).
 *
 * @param {{ strategyName: string, clientIdConfigKey: string, clientSecretConfigKey: string }} options
 * @returns {{ plugin: object }}
 */
export function createBasicAuthPlugin({
  strategyName,
  clientIdConfigKey,
  clientSecretConfigKey
}) {
  /**
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
      clientId !== config.get(clientIdConfigKey) ||
      secret !== config.get(clientSecretConfigKey)
    ) {
      return unauthorized(h)
    }

    return h.authenticated({ credentials: { clientId } })
  }

  return {
    plugin: {
      name: `${strategyName}-auth`,
      register(server) {
        server.auth.scheme(strategyName, () => ({ authenticate }))
        server.auth.strategy(strategyName, strategyName)
      }
    }
  }
}
