import { statusCodes } from '../common/constants/status-codes.js'
import { AUTH_STRATEGY } from './auth.js'
import { animalsOnHolding, findAnimalDetail } from './data/animals.js'
import { problem, validationProblem } from '../common/helpers/problem.js'
import { bindAnimalsQuery } from './helpers/animals-query.js'

/** @import { Request, ResponseToolkit, ResponseObject } from '@hapi/hapi' */

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
      'No animal found for the requested identifier.'
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
