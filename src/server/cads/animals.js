import { statusCodes } from '../common/constants/status-codes.js'
import { AUTH_STRATEGY } from './auth.js'
import { animalsForCph, findAnimalDetail, isKnownCph } from './data/animals.js'
import { problem } from './helpers/problem.js'
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  parsePagingParam,
  paginate
} from './helpers/pagination.js'

/** @import { Request, ResponseToolkit, ResponseObject } from '@hapi/hapi' */

const CPH_QUERY_PARAM = 'CPH'

// Orders animals by ear tag ascending. This is the only ordering the fake
// applies: ULITP-5614's default when no order-by is given. The order/sort
// query params are accepted but not yet honoured.
function byEarTag(a, b) {
  return a.identifier.identifier.localeCompare(b.identifier.identifier)
}

// Static metadata attached to every AnimalDetail response, mirroring the
// shape agreed in LANI-802 (the data originates from CTS).
const ANIMAL_DETAIL_SOURCE = {
  system: 'CTS',
  schema: 'animal_details',
  schemaVersion: '1.0'
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
  const { identifier } = request.params
  const animalDetail = findAnimalDetail(identifier)

  if (!animalDetail) {
    return problem(
      h,
      statusCodes.notFound,
      'Not Found',
      `No animal found for identifier ${identifier}.`
    )
  }

  return h
    .response({
      resourceType: 'AnimalDetail',
      identifier,
      eventDateTime: new Date().toISOString(),
      source: ANIMAL_DETAIL_SOURCE,
      animalDetail
    })
    .code(statusCodes.ok)
}

/**
 * GET /cads/api/v1/bovine/animals?CPH=08/065/0077
 * Static bovine animals on a CPH (LANI-803), in cads-data-service's
 * PaginatedResult<T> shape, ordered by ear tag ascending.
 *
 * Only `page` / `pageSize` are honoured. `order` / `sort` / `holdingAssociation`
 * / `q` (and any other query param) are accepted without error but ignored -
 * they're not yet part of what the fake needs to reproduce.
 *
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @returns {ResponseObject}
 */
function getAnimalsOnHoldingHandler(request, h) {
  const cph = request.query[CPH_QUERY_PARAM]

  if (!cph) {
    return problem(
      h,
      statusCodes.badRequest,
      'Bad Request',
      `Query parameter ${CPH_QUERY_PARAM} is required.`
    )
  }

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
      `No holding found for CPH ${cph}.`
    )
  }

  const ordered = animalsForCph(cph).sort(byEarTag)

  return h.response(paginate(ordered, page, pageSize)).code(statusCodes.ok)
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
