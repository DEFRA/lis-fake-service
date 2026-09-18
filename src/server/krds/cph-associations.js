import { statusCodes } from '../common/constants/status-codes.js'
import { AUTH_STRATEGY } from './auth.js'
import { cphsForEmail } from '../common/data/locations.js'
import { problem } from '../common/helpers/problem.js'

/** @import { Request, ResponseToolkit, ResponseObject } from '@hapi/hapi' */

/**
 * GET /api/v2/cph-associations?Email=
 * The CPHs an email address is associated with, and in what role (V2
 * keeper-data-api contract).
 *
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @returns {ResponseObject}
 */
function getCphAssociationsHandler(request, h) {
  const email = request.query.Email

  if (!email) {
    return problem(
      h,
      statusCodes.badRequest,
      'Bad Request',
      'Query parameter Email is required.'
    )
  }

  const associations = cphsForEmail(email)
  const deduplicated = [
    ...new Map(
      associations.map((assoc) => [`${assoc.cph}:${assoc.role}`, assoc])
    ).values()
  ]

  return h.response(deduplicated).code(statusCodes.ok)
}

export const cphAssociationsRoutes = [
  {
    method: 'GET',
    path: '/krds/api/v2/cph-associations',
    options: { auth: AUTH_STRATEGY },
    handler: getCphAssociationsHandler
  }
]
