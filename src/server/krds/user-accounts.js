import { validate as isUuid } from 'uuid'
import { statusCodes } from '../common/constants/status-codes.js'
import { AUTH_STRATEGY } from './auth.js'
import { userAccountStore } from './data/user-accounts.js'
import { problem, validationProblem } from '../common/helpers/problem.js'

/** @import { Request, ResponseToolkit, ResponseObject } from '@hapi/hapi' */

/**
 * POST /api/v2/user-accounts
 * Ensures a user account exists for the supplied identity provider claims
 * (V2 keeper-data-api contract).
 *
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @returns {ResponseObject}
 */
function postUserAccountHandler(request, h) {
  const { email } = request.payload ?? {}

  if (!email) {
    return validationProblem(
      h,
      'email is required.',
      { email: ['email must not be null or blank.'] },
      statusCodes.unprocessableEntity
    )
  }

  const result = userAccountStore.ensureAccount(request.payload)

  if (result.conflict) {
    return problem(
      h,
      statusCodes.conflict,
      'Conflict',
      'The supplied email is already associated with a different account.'
    )
  }

  return h
    .response(result.account)
    .code(result.created ? statusCodes.created : statusCodes.ok)
}

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

export const userAccountsRoutes = [
  {
    method: 'POST',
    path: '/krds/api/v2/user-accounts',
    options: { auth: AUTH_STRATEGY },
    handler: postUserAccountHandler
  },
  {
    method: 'GET',
    path: '/krds/api/v2/user-accounts/{subject}',
    options: { auth: AUTH_STRATEGY },
    handler: getUserAccountHandler
  }
]
