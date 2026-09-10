/** @import { ResponseToolkit, ResponseObject } from '@hapi/hapi' */

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
  return h.response({ title, status, detail }).code(status)
}
