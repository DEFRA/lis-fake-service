import { validate as isUuid } from 'uuid'
import { statusCodes } from '../../common/constants/status-codes.js'
import { AUTH_STRATEGY } from '../auth.js'
import { userAccountStore } from '../data/user-accounts.js'
import { problem, validationProblem } from '../../common/helpers/problem.js'

/** @import { Request, ResponseToolkit, ResponseObject } from '@hapi/hapi' */

/**
 * GET /api/v2/user-accounts/{subject}
 * Reads a user account by identity provider subject (V2 keeper-data-api
 * contract). Read-only - no association refresh is performed.
 *
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @returns {ResponseObject}
 */
function getUserAccountHandler(request, h) {
  const { subject } = request.params

  if (!isUuid(subject)) {
    return validationProblem(
      h,
      'subject is not a valid identifier.',
      { subject: ['subject must be a valid identity provider subject claim.'] },
      statusCodes.unprocessableEntity
    )
  }

  const account = userAccountStore.findAccount(subject)

  if (!account) {
    return problem(
      h,
      statusCodes.notFound,
      'Not Found',
      'The subject is not recognised.'
    )
  }

  return h.response(account).code(statusCodes.ok)
}

export const getOne = {
  method: 'GET',
  path: '/krds/api/v2/user-accounts/{subject}',
  options: { auth: AUTH_STRATEGY },
  handler: getUserAccountHandler
}
