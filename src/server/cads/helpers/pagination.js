// cads-data-service pagination, mirroring its BuildingBlocks QueryFactory /
// PagedQuery<T> defaults and PaginatedResult<T> response shape. Shared by the
// /cads feature routes; kept here so it can grow its own tests and be reused
// by other fakes.

// The 25-per-page figure in LANI-803 is a front-office page-size choice, not
// the endpoint's default.
export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_SIZE = 10

/**
 * Parses a paging query param: absent -> fallback; present and a positive
 * integer -> that value; anything else -> null (a 400, as ASP.NET model
 * binding would reject it).
 *
 * @param {string | undefined} value
 * @param {number} fallback
 * @returns {number | null}
 */
export function parsePagingParam(value, fallback) {
  if (value === undefined) {
    return fallback
  }
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null
}

/**
 * Slices `items` to the requested page and wraps it in cads-data-service's
 * PaginatedResult<T> shape (serialised camelCase).
 *
 * @template T
 * @param {T[]} items - the full, already-filtered/sorted collection
 * @param {number} page - 1-indexed
 * @param {number} pageSize
 * @returns {{
 *   results: T[],
 *   count: number,
 *   totalCount: number,
 *   page: number,
 *   pageSize: number,
 *   totalPages: number,
 *   hasNextPage: boolean,
 *   hasPreviousPage: boolean
 * }}
 */
export function paginate(items, page, pageSize) {
  const totalCount = items.length
  const start = (page - 1) * pageSize
  const results = items.slice(start, start + pageSize)
  const totalPages = Math.ceil(totalCount / pageSize)

  return {
    results,
    count: results.length,
    totalCount,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  }
}
