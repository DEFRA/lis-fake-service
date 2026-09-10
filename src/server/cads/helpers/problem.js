import { statusCodes } from '../../common/constants/status-codes.js'

/** @import { ResponseToolkit, ResponseObject } from '@hapi/hapi' */

// The `type` URI ASP.NET's ProblemDetails defaults to per status code.
const PROBLEM_TYPE = {
  [statusCodes.badRequest]:
    'https://tools.ietf.org/html/rfc9110#section-15.5.1',
  [statusCodes.unauthorized]:
    'https://tools.ietf.org/html/rfc9110#section-15.5.2',
  [statusCodes.notFound]: 'https://tools.ietf.org/html/rfc9110#section-15.5.5'
}

/**
 * Builds an RFC 7807 ProblemDetails response, matching what ASP.NET returns
 * from the real cads-data-service for 4xx responses.
 *
 * @param {ResponseToolkit} h
 * @param {number} status
 * @param {string} title
 * @param {string} detail
 * @returns {ResponseObject}
 */
export function problem(h, status, title, detail) {
  return h
    .response({ type: PROBLEM_TYPE[status], title, status, detail })
    .code(status)
}
