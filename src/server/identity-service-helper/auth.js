/** @import { Request, ResponseToolkit } from '@hapi/hapi' */
import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants/status-codes.js'

const API_KEY_HEADER = 'x-api-key'
const CORRELATION_ID_HEADER = 'x-correlation-id'
const STRATEGY_NAME = 'identity-service-helper'

function headerError(request, h, { code, message, header }) {
  return h
    .response({
      error: {
        code,
        message,
        traceId: request.info.id,
        path: request.path,
        details: { header }
      }
    })
    .code(statusCodes.badRequest)
    .takeover()
}

// Mirrors identity-service-helper's CorrelationIdMiddleware: strips
// surrounding whitespace/quotes, treating the result as missing if empty.
function normalizeCorrelationId(value) {
  return (
    value
      ?.trim()
      .replace(/^['"]|['"]$/g, '')
      .trim() || null
  )
}

/**
 * Mirrors identity-service-helper's globally-applied ApiKeyValidationMiddleware
 * and CorrelationIdMiddleware, same error codes/shape: a valid x-api-key and a
 * non-empty x-correlation-id header are required.
 *
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @returns {ReturnType<ResponseToolkit['authenticated']> | ReturnType<ResponseToolkit['response']>}
 */
function authenticate(request, h) {
  const apiKey = request.headers[API_KEY_HEADER]

  if (!apiKey) {
    return headerError(request, h, {
      code: 'missing_header',
      message: `Header ${API_KEY_HEADER} is required.`,
      header: API_KEY_HEADER
    })
  }

  if (apiKey !== config.get('identityServiceHelper.apiKey')) {
    return headerError(request, h, {
      code: 'invalid_api_key',
      message: `Header ${API_KEY_HEADER} is not valid.`,
      header: API_KEY_HEADER
    })
  }

  if (!normalizeCorrelationId(request.headers[CORRELATION_ID_HEADER])) {
    return headerError(request, h, {
      code: 'missing_header',
      message: `Header ${CORRELATION_ID_HEADER} is required.`,
      header: CORRELATION_ID_HEADER
    })
  }

  return h.authenticated({ credentials: {} })
}

// A Hapi auth provider: routes opt in with `options: { auth: 'identity-service-helper' }`
// rather than each wiring up the header checks themselves.
export const identityServiceHelperAuth = {
  plugin: {
    name: 'identity-service-helper-auth',
    register(server) {
      server.auth.scheme(STRATEGY_NAME, () => ({ authenticate }))
      server.auth.strategy(STRATEGY_NAME, STRATEGY_NAME)
    }
  }
}

export const AUTH_STRATEGY = STRATEGY_NAME
