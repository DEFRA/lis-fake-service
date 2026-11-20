import { config } from '../../../config/config.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { createToken } from '../token.js'

/** @import { Request, ResponseToolkit, ResponseObject } from '@hapi/hapi' */

/**
 * @param {unknown} value
 * @returns {value is string} whether the value is a non-empty string
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value !== ''
}

/**
 * @param {{ UserId?: unknown, Password?: unknown, CallerId?: unknown } | null | undefined} body
 * @returns {boolean} whether credentials are configured and the body carries them and a caller id
 */
function hasValidCredentials(body) {
  const userId = config.get('luis.userId')
  const password = config.get('luis.password')

  // There are no default credentials: until all three are configured, no
  // request can succeed.
  return (
    isNonEmptyString(userId) &&
    isNonEmptyString(password) &&
    isNonEmptyString(config.get('luis.tokenSecret')) &&
    body?.UserId === userId &&
    body?.Password === password &&
    isNonEmptyString(body?.CallerId)
  )
}

/**
 * POST /luis/Api/{v}/RequestToken
 * Exchanges credentials for a bearer token, returned as the bare JWT.
 *
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @returns {ResponseObject}
 */
function requestTokenHandler(request, h) {
  const body = /** @type {{ CallerId?: string, UserId?: string } | null} */ (
    request.payload
  )

  // The real service's failure shape is unconfirmed; an empty 401 is assumed.
  if (!hasValidCredentials(body)) {
    return h.response().code(statusCodes.unauthorized)
  }

  const token = createToken({
    userId: /** @type {string} */ (body?.UserId),
    callerId: /** @type {string} */ (body?.CallerId)
  })

  return h.response(token).type('text/plain').code(statusCodes.ok)
}

export const post = {
  method: 'POST',
  path: '/luis/Api/{version}/RequestToken',
  handler: requestTokenHandler
}
