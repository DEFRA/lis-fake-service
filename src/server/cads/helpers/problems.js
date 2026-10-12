import { randomBytes, randomUUID } from 'node:crypto'
import { statusCodes } from '../../common/constants/status-codes.js'

/** @import { Request, ResponseToolkit, ResponseObject } from '@hapi/hapi' */

// cads-data-service has three error paths, each with its own body: no body at
// all for a failed auth challenge, ASP.NET's own ProblemDetails for model
// binding failures and bare NotFound() results, and the service's
// ExceptionHandlingMiddleware for FluentValidation failures.

const BAD_REQUEST_TYPE = 'https://tools.ietf.org/html/rfc9110#section-15.5.1'
const NOT_FOUND_TYPE = 'https://tools.ietf.org/html/rfc9110#section-15.5.5'

const CORRELATION_HEADER = 'x-correlation-id'
const MOUNT_PREFIX = '/cads'
const TRACE_ID_BYTES = 16
const SPAN_ID_BYTES = 8

// ASP.NET stamps its own ProblemDetails with the request's W3C trace parent.
function traceParent() {
  const traceId = randomBytes(TRACE_ID_BYTES).toString('hex')
  const spanId = randomBytes(SPAN_ID_BYTES).toString('hex')
  return `00-${traceId}-${spanId}-00`
}

/**
 * @param {ResponseToolkit} h
 * @returns {ResponseObject}
 */
export function unauthorized(h) {
  return h.response().code(statusCodes.unauthorized)
}

/**
 * @param {ResponseToolkit} h
 * @returns {ResponseObject}
 */
export function notFound(h) {
  return h
    .response({
      type: NOT_FOUND_TYPE,
      title: 'Not Found',
      status: statusCodes.notFound,
      traceId: traceParent()
    })
    .code(statusCodes.notFound)
}

/**
 * The 400 ASP.NET returns itself when a request fails model binding.
 *
 * @param {ResponseToolkit} h
 * @param {Record<string, string[]>} errors
 * @returns {ResponseObject}
 */
export function modelBindingFailure(h, errors) {
  return h
    .response({
      type: BAD_REQUEST_TYPE,
      title: 'One or more validation errors occurred.',
      status: statusCodes.badRequest,
      errors,
      traceId: traceParent()
    })
    .code(statusCodes.badRequest)
}

/**
 * The 400 ExceptionHandlingMiddleware returns for a FluentValidation failure.
 * traceId and correlationId are both the caller's correlation id, or one
 * generated for the request when the header is absent.
 *
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @param {Record<string, string[]>} errors
 * @returns {ResponseObject}
 */
export function validationFailure(request, h, errors) {
  const correlationId = request.headers[CORRELATION_HEADER] ?? randomUUID()

  return h
    .response({
      title: 'Validation errors',
      status: statusCodes.badRequest,
      detail:
        "One or more validation errors occurred. See the 'errors' field for details.",
      instance: request.path.slice(MOUNT_PREFIX.length),
      errors,
      traceId: correlationId,
      correlationId,
      errorId: randomUUID()
    })
    .code(statusCodes.badRequest)
}
