import { statusCodes } from '../../common/constants/status-codes.js'
import { AUTH_STRATEGY } from '../auth.js'
import { userAccountStore } from '../data/user-accounts.js'
import { problem, validationProblem } from '../../common/helpers/problem.js'

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

export const post = {
  method: 'POST',
  path: '/krds/api/v2/user-accounts',
  options: { auth: AUTH_STRATEGY },
  handler: postUserAccountHandler
}
