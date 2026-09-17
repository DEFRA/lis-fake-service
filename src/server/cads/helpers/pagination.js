// cads-data-service's bovine animals-on-CPH pagination (LANI-803,
// feature/lani-803's GetAnimalsOnCph/AnimalCollectionDto). page/page-size
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
 * Slices `items` to the requested page and wraps it in cads-data-service's
 * AnimalCollectionDto shape (serialised camelCase). totalPages is always at
 * least 1, even for zero records (Math.Max(1, ...) in the real service).
 *
 * @template T
 * @param {T[]} items - the full, already-filtered/sorted collection
 * @param {number} page - 1-indexed
 * @param {number} pageSize
 * @returns {{
 *   resourceType: string,
 *   page: number,
 *   pageSize: number,
 *   totalPages: number,
 *   totalRecords: number,
 *   animals: T[]
 * }}
 */
export function paginate(items, page, pageSize) {
  const totalRecords = items.length
  const start = (page - 1) * pageSize
  const animals = items.slice(start, start + pageSize)
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))

  return {
    resourceType: 'AnimalCollection',
    page,
    pageSize,
    totalPages,
    totalRecords,
    animals
  }
}
