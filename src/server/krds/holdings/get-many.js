import { statusCodes } from '../../common/constants/status-codes.js'
import { AUTH_STRATEGY } from '../auth.js'
import { searchHoldings } from '../data/holdings.js'
import { validationProblem } from '../../common/helpers/problem.js'

/** @import { Request, ResponseToolkit, ResponseObject } from '@hapi/hapi' */

/** @import { HoldingSearch } from '../data/holdings.js' */

const SEARCH_MAX_LENGTH = 200
const SEARCH_PATTERN = /^[\p{L}\p{N}\s/'@.+(),&-]*$/u
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u
const INTEGER_PATTERN = /^-?\d+$/
const SORT_PATTERN = /^(asc|desc)$/i
const ORDER_FIELDS = [
  'cph',
  'identifier',
  'name',
  'holdingType',
  'startDate',
  'endDate'
]
const DEFAULT_PAGE = 1
const MAX_PAGE = 2147483647
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100

/**
 * @param {string} search
 * @returns {string | undefined} the validation error, if any
 */
function searchError(search) {
  if (search.length > SEARCH_MAX_LENGTH) {
    return 'Search must be at most 200 characters.'
  }
  if (!SEARCH_PATTERN.test(search)) {
    return 'Search contains an unsupported expression. Use words, spaces, email or phone punctuation, commas, ampersands, apostrophes, hyphens or CPH slashes.'
  }
  if (search.trim() !== '' && !LETTER_OR_DIGIT.test(search)) {
    return 'Search must contain at least one letter or digit.'
  }
  return undefined
}

/**
 * @param {string | undefined} value
 * @param {{ name: string, fallback: number, max: number, rangeMessage: string }} rule
 * @returns {{ value: number, error?: string }}
 */
function parseBoundedInteger(value, { name, fallback, max, rangeMessage }) {
  if (value === undefined || value === '') {
    return { value: fallback }
  }
  if (!INTEGER_PATTERN.test(value)) {
    return {
      value: fallback,
      error: `The value '${value}' is not valid for ${name}.`
    }
  }
  const parsed = Number(value)
  return parsed >= 1 && parsed <= max
    ? { value: parsed }
    : { value: fallback, error: rangeMessage }
}

/**
 * Validates the query as keeper-data-api's GetHoldingsRequest does, applying
 * the same defaults.
 *
 * @param {Request['query']} query
 * @returns {{ search: HoldingSearch, errors: Record<string, string[]> }}
 */
function parseSearchQuery(query) {
  const search = query.search ?? ''
  const sort = query.sort ?? 'asc'
  const order = query.order ?? 'cph'
  const page = parseBoundedInteger(query.page, {
    name: 'page',
    fallback: DEFAULT_PAGE,
    max: MAX_PAGE,
    rangeMessage: 'Page must be greater than or equal to 1.'
  })
  const pageSize = parseBoundedInteger(query.pageSize, {
    name: 'pageSize',
    fallback: DEFAULT_PAGE_SIZE,
    max: MAX_PAGE_SIZE,
    rangeMessage: 'PageSize must be between 1 and 100.'
  })
  const orderField = ORDER_FIELDS.find(
    (field) => field.toLowerCase() === order.toLowerCase()
  )

  const errors = Object.fromEntries(
    Object.entries({
      search: searchError(search),
      page: page.error,
      pageSize: pageSize.error,
      sort: SORT_PATTERN.test(sort)
        ? undefined
        : "Sort must be 'asc' or 'desc'.",
      order: orderField
        ? undefined
        : 'Order must be cph, identifier, name, holdingType, startDate, or endDate.'
    })
      .filter(([, error]) => error !== undefined)
      .map(([name, error]) => [name, [error]])
  )

  return {
    search: {
      search,
      page: page.value,
      pageSize: pageSize.value,
      sort: /** @type {HoldingSearch['sort']} */ (sort.toLowerCase()),
      order: /** @type {HoldingSearch['order']} */ (orderField ?? 'cph')
    },
    errors
  }
}

/**
 * GET /api/v2/holdings
 * A page of holding details, optionally filtered by a free-text search
 * (V2 keeper-data-api contract).
 *
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @returns {ResponseObject}
 */
function getHoldingsHandler(request, h) {
  const { search, errors } = parseSearchQuery(request.query)

  if (Object.keys(errors).length > 0) {
    return validationProblem(
      h,
      'One or more validation errors occurred.',
      errors
    )
  }

  return h.response(searchHoldings(search)).code(statusCodes.ok)
}

export const getMany = {
  method: 'GET',
  path: '/krds/api/v2/holdings',
  options: { auth: AUTH_STRATEGY },
  handler: getHoldingsHandler
}
