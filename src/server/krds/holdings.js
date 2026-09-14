import { statusCodes } from '../common/constants/status-codes.js'
import { AUTH_STRATEGY } from './auth.js'
import { findHolding } from './data/holdings.js'
import { problem, validationProblem } from '../common/helpers/problem.js'

/** @import { Request, ResponseToolkit, ResponseObject } from '@hapi/hapi' */

const SEGMENT_PATTERN = {
  county: /^\d{2}$/,
  parish: /^\d{3}$/,
  holding: /^\d{4}$/
}

/**
 * @param {Request['params']} params
 * @returns {Record<string, string[]>} field-name-keyed validation errors, empty if none
 */
function segmentErrors(params) {
  return Object.fromEntries(
    Object.entries(SEGMENT_PATTERN)
      .filter(([name, pattern]) => !pattern.test(params[name]))
      .map(([name]) => [
        name,
        [`${name} does not match the expected CPH segment format.`]
      ])
  )
}

/**
 * GET /api/v2/holdings/{county}/{parish}/{holding}
 * Holding detail by CPH (V2 keeper-data-api contract).
 *
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @returns {ResponseObject}
 */
function getHoldingDetailHandler(request, h) {
  const { county, parish, holding } = request.params

  const errors = segmentErrors(request.params)
  if (Object.keys(errors).length > 0) {
    return validationProblem(h, 'One or more CPH segments are invalid.', errors)
  }

  const holdingDetail = findHolding(county, parish, holding)

  if (!holdingDetail) {
    return problem(
      h,
      statusCodes.notFound,
      'Not Found',
      'CPH not in the snapshot.'
    )
  }

  return h.response(holdingDetail).code(statusCodes.ok)
}

export const holdingsRoutes = [
  {
    method: 'GET',
    path: '/krds/api/v2/holdings/{county}/{parish}/{holding}',
    options: { auth: AUTH_STRATEGY },
    handler: getHoldingDetailHandler
  }
]
