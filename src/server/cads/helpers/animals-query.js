// Query binding for GET /cads/api/v1/bovine/animals, mirroring cads-data-service's
// AnimalsOnHoldingQueryAdapter: enums bind case-insensitively, paging values are
// clamped rather than rejected, and every binding error is reported together.
export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100
const MIN_PAGE_SIZE = 1

const SEXES = ['Female', 'Male']
const ORDER_BYS = ['Identifier', 'BirthDate', 'DateOnCPH', 'Sex', 'BreedCode']
const DIRECTIONS = ['Asc', 'Desc']
const INTEGER_PATTERN = /^[+-]?\d+$/

// A repeated query param gives Hapi an array; the first value wins.
function firstValue(value) {
  return Array.isArray(value) ? value[0] : value
}

function isAbsent(value) {
  return value === undefined || value === ''
}

function invalid(name, value) {
  return { error: [`The value '${value}' is not valid for ${name}.`] }
}

function bindEnum(name, raw, allowed, fallback) {
  const value = firstValue(raw)
  if (isAbsent(value)) {
    return { value: fallback }
  }
  const match = allowed.find((a) => a.toLowerCase() === value.toLowerCase())
  return match ? { value: match } : invalid(name, value)
}

function bindInteger(name, raw, fallback) {
  const value = firstValue(raw)
  if (isAbsent(value)) {
    return { value: fallback }
  }
  return INTEGER_PATTERN.test(value)
    ? { value: Number(value) }
    : invalid(name, value)
}

/**
 * @param {Record<string, string | string[] | undefined>} query
 * @returns {{
 *   params: {
 *     cph: string,
 *     sex: string | undefined,
 *     breedCode: string | undefined,
 *     page: number,
 *     pageSize: number,
 *     orderBy: string,
 *     direction: string
 *   },
 *   errors: Record<string, string[]>
 * }}
 */
export function bindAnimalsQuery(query) {
  const errors = {}
  const bound = {
    sex: bindEnum('sex', query.sex, SEXES, undefined),
    page: bindInteger('page', query.page, DEFAULT_PAGE),
    pageSize: bindInteger('pageSize', query.pageSize, DEFAULT_PAGE_SIZE),
    orderBy: bindEnum('orderBy', query.orderBy, ORDER_BYS, 'Identifier'),
    direction: bindEnum('direction', query.direction, DIRECTIONS, 'Asc')
  }
  for (const [name, result] of Object.entries(bound)) {
    if (result.error) {
      errors[name] = result.error
    }
  }

  const cph = firstValue(query.CPH)
  if (isAbsent(cph)) {
    errors.CPH = ['The CPH field is required.']
  }

  const breedCode = firstValue(query.breedCode)?.trim().toUpperCase()

  return {
    params: {
      cph,
      sex: bound.sex.value,
      breedCode: breedCode || undefined,
      page: Math.max(bound.page.value ?? DEFAULT_PAGE, DEFAULT_PAGE),
      pageSize: Math.min(
        Math.max(bound.pageSize.value ?? DEFAULT_PAGE_SIZE, MIN_PAGE_SIZE),
        MAX_PAGE_SIZE
      ),
      orderBy: bound.orderBy.value,
      direction: bound.direction.value
    },
    errors
  }
}
