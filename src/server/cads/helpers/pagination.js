// cads-data-service's bovine animals-on-CPH pagination (LANI-803,
// feature/lani-803's GetAnimalsOnCph/AnimalCollectionDto). page/pageSize
// always default when absent - the endpoint has no "return everything"
// mode.
export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_SIZE = 25

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
 * Slices `items` to the requested page and wraps it in the envelope
 * lis-api-cattle deserialises (CadsPaginatedResult<CadsAnimal>, serialised
 * camelCase). totalPages is always at least 1, even for zero records.
 *
 * NOTE: this deliberately does NOT match cads-data-service, which returns
 * AnimalsOnHoldingDto - `animals`, plus CPH and locationName, and no paging
 * metadata at all. This is a temporary stopgap so lis-api-cattle works
 * locally; the real fix is to correct the model in lis-api-cattle. Until
 * then, code that passes against this fake will still fail against CADS.
 *
 * @template T
 * @param {T[]} items - the full, already-filtered/sorted collection
 * @param {number} page - 1-indexed
 * @param {number} pageSize
 * @returns {{
 *   resourceType: string,
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
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return {
    resourceType: 'AnimalCollection',
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
