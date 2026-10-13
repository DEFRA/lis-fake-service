import { statusCodes } from '../common/constants/status-codes.js'
import { AUTH_STRATEGY } from './auth.js'
import { animalsOnHolding, findAnimalDetail } from './data/animals.js'
import { validationProblem } from '../common/helpers/problem.js'
import { bindAnimalsQuery } from './helpers/animals-query.js'
import {
  modelBindingFailure,
  notFound,
  validationFailure
} from './helpers/problems.js'

/** @import { Request, ResponseToolkit, ResponseObject } from '@hapi/hapi' */

// Static metadata attached to every AnimalDetail response, mirroring the
// shape agreed in LANI-802 (the data originates from CTS).
const ANIMAL_DETAIL_SOURCE = {
  system: 'CTS',
  schema: 'animal_details',
  schemaVersion: '1.0'
}

// cads-data-service reports eventDateTime to the second.
const MILLISECONDS = /\.\d{3}(?=Z$)/

const IDENTIFIER_MAX_LENGTH = 20
const IDENTIFIER_PATTERN = /^[A-Za-z0-9 ]+$/

/**
 * Mirrors cads-data-service's GetAnimalDetailsByIdentifierValidator. Its rules
 * are declared against Identifier.Trim(), which leaves FluentValidation with
 * no property name, so the real messages quote an empty name.
 *
 * @param {string} identifier already trimmed
 * @returns {string[]} one message per failed rule
 */
function validateIdentifier(identifier) {
  const errors = []
  if (identifier.length > IDENTIFIER_MAX_LENGTH) {
    errors.push(
      `The length of '' must be ${IDENTIFIER_MAX_LENGTH} characters or fewer. You entered ${identifier.length} characters.`
    )
  }
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    errors.push("'' is not in the correct format.")
  }
  return errors
}

/**
 * GET /cads/api/v1/bovine/animals/{identifier}
 * Static bovine animal details (LANI-802).
 *
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @returns {ResponseObject}
 */
function getAnimalDetailsHandler(request, h) {
  const identifier = request.params.identifier.trim()

  // A whitespace-only route value never reaches the validator: model binding
  // reads it as missing.
  if (identifier === '') {
    return modelBindingFailure(h, {
      identifier: ['The identifier field is required.']
    })
  }

  const identifierErrors = validateIdentifier(identifier)

  if (identifierErrors.length > 0) {
    return validationFailure(request, h, { '': identifierErrors })
  }

  const animalDetail = findAnimalDetail(identifier)

  if (!animalDetail) {
    return notFound(h)
  }

  return h
    .response({
      resourceType: 'AnimalDetail',
      identifier,
      eventDateTime: new Date().toISOString().replace(MILLISECONDS, ''),
      source: ANIMAL_DETAIL_SOURCE,
      animalDetail
    })
    .code(statusCodes.ok)
}

/**
 * GET /cads/api/v1/bovine/animals?CPH=08/065/0077
 * Animals currently on a CPH, in cads-data-service's AnimalsOnHoldingDto shape
 * (BovineController.GetAnimalsOnHolding). An unknown CPH is an empty list, not
 * an error. Query params other than CPH, sex, breedCode, page, pageSize,
 * orderBy and direction are ignored.
 *
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @returns {ResponseObject}
 */
function getAnimalsOnHoldingHandler(request, h) {
  const { params, errors } = bindAnimalsQuery(request.query)

  if (Object.keys(errors).length > 0) {
    return validationProblem(
      h,
      'One or more validation errors occurred.',
      errors
    )
  }

  const { locationName, animals, totalRecords } = animalsOnHolding(params)

  return h
    .response({
      resourceType: 'AnimalCollection',
      CPH: { schema: 'uk.gov.defra.cph', identifier: params.cph },
      locationName,
      animals,
      totalRecords,
      page: params.page,
      pageSize: params.pageSize
    })
    .code(statusCodes.ok)
}

export const animalsRoutes = [
  {
    method: 'GET',
    path: '/cads/api/v1/bovine/animals/{identifier}',
    options: { auth: AUTH_STRATEGY },
    handler: getAnimalDetailsHandler
  },
  {
    method: 'GET',
    path: '/cads/api/v1/bovine/animals',
    options: { auth: AUTH_STRATEGY },
    handler: getAnimalsOnHoldingHandler
  }
]
