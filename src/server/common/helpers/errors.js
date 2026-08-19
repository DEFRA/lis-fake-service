/** @import { Request, ResponseToolkit, Lifecycle } from '@hapi/hapi' */
import { statusCodes } from '../constants/status-codes.js'
import { config } from '../../../config/config.js'
import { logger } from './logging/logger.js'

function statusCodeMessage(statusCode) {
  switch (statusCode) {
    case statusCodes.notFound:
      return 'Page not found'
    case statusCodes.forbidden:
      return 'Forbidden'
    case statusCodes.unauthorized:
      return 'Unauthorized'
    case statusCodes.badRequest:
      return 'Bad Request'
    default:
      return 'Something went wrong'
  }
}

/**
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @returns {Lifecycle.ReturnValue}
 */
export function catchAll(request, h) {
  const { response } = request

  if (!('isBoom' in response)) {
    return h.continue
  }

  const statusCode = response.output.statusCode
  const errorMessage = statusCodeMessage(statusCode)

  if (statusCode >= statusCodes.internalServerError) {
    logger.error(response?.stack)
  }

  const payload = {
    error: {
      statusCode,
      message: errorMessage
    }
  }

  if (!config.get('isProduction')) {
    payload.error.devMessage = response.message
  }

  return h.response(payload).code(statusCode)
}
