import { statusCodes } from '../common/constants/status-codes.js'
import { AUTH_STRATEGY } from './auth.js'
import { animalsForCph, findAnimalDetail, isKnownCph } from './data/animals.js'
import { problem } from '../common/helpers/problem.js'
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  parsePagingParam,
  paginate
} from './helpers/pagination.js'
import {
  modelBindingFailure,
  notFound,
  validationFailure
} from './helpers/problems.js'

/** @import { Request, ResponseToolkit, ResponseObject } from '@hapi/hapi' */

const CPH_QUERY_PARAM = 'CPH'

// A repeated query param gives Hapi an array; a single one gives a string.
// Normalise to an array so filters can treat both the same way.
function asArray(value) {
  if (value === undefined) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

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
 * Static bovine animals on a CPH (LANI-803), in cads-data-service's
 * AnimalCollectionDto shape (feature/lani-803).
 *
 * Supports holdingAssociation (MovedOnHolding default, or
 * RegisteredOnHolding), status/breedCode filters (repeatable) and a single
 * sex filter, dateOnCPHFrom, free-text search (q), sorting
 * (orderBy/direction) and paging (page/pageSize, defaulting to 1/25).
 *
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @returns {ResponseObject}
 */
function getAnimalsOnHoldingHandler(request, h) {
  const rawCph = request.query[CPH_QUERY_PARAM]

  if (!rawCph) {
    return problem(
      h,
      statusCodes.badRequest,
      'Bad Request',
      `Query parameter ${CPH_QUERY_PARAM} is required.`
    )
  }

  // A repeated ?CPH= gives Hapi an array; take the first value.
  const cph = Array.isArray(rawCph) ? rawCph[0] : rawCph

  const page = parsePagingParam(request.query.page, DEFAULT_PAGE)
  const pageSize = parsePagingParam(request.query.pageSize, DEFAULT_PAGE_SIZE)

  if (page === null || pageSize === null) {
    return problem(
      h,
      statusCodes.badRequest,
      'Bad Request',
      'Query parameters page and pageSize must be positive integers.'
    )
  }

  // A recognised CPH with no animals is a success (an empty page); only an
  // unrecognised CPH is a 404 (LANI-803).
  if (!isKnownCph(cph)) {
    return problem(
      h,
      statusCodes.notFound,
      'Not Found',
      'No holding found for the requested CPH.'
    )
  }

  const filtered = animalsForCph(cph, {
    holdingAssociation: request.query.holdingAssociation,
    status: asArray(request.query.status),
    sex: request.query.sex,
    breedCode: asArray(request.query.breedCode),
    dateOnCPHFrom: request.query.dateOnCPHFrom,
    q: request.query.q,
    orderBy: request.query.orderBy,
    direction: request.query.direction
  })

  return h.response(paginate(filtered, page, pageSize)).code(statusCodes.ok)
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
