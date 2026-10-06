import { allLocations, findLocation } from '../../common/data/locations.js'

/** @import { Location } from '../../common/data/locations.js' */

// Shapes mirror keeper-data-api's OpenAPI (v2) schemas of the same name.

/**
 * @typedef {object} HoldingAddress
 * @property {number | string | null} udprn
 * @property {string | null} addressLine1
 * @property {string | null} addressLine2
 * @property {string | null} postTown
 * @property {string | null} locality
 * @property {string | null} postcode
 * @property {string | null} country
 */

/**
 * @typedef {object} HoldingLocation
 * @property {string | null} osMapReference
 * @property {number | string | null} easting
 * @property {number | string | null} northing
 * @property {HoldingAddress} address
 */

/**
 * @typedef {object} HoldingRole
 * @property {string} code
 * @property {string[]} species
 */

/**
 * @typedef {object} PartyAddress
 * @property {string | null} addressLine1
 * @property {string | null} addressLine2
 * @property {string | null} addressTown
 * @property {string | null} addressLocality
 * @property {string | null} addressNation
 * @property {string | null} addressPostcode
 * @property {string | null} addressCountryCode
 */

/**
 * @typedef {object} HoldingAssociation
 * @property {string} customerNumber
 * @property {string | null} title
 * @property {string | null} firstName
 * @property {string | null} lastName
 * @property {string | null} name
 * @property {string} partyType
 * @property {string | null} email
 * @property {string | null} mobile
 * @property {string | null} telephone
 * @property {PartyAddress} address
 * @property {HoldingRole[]} roles
 */

/**
 * @typedef {object} HoldingMark
 * @property {string} mark
 * @property {string | null} startDate
 * @property {string | null} endDate
 * @property {string[]} species
 */

/**
 * @typedef {object} HoldingDetail
 * @property {string} identifier
 * @property {string | null} holdingType
 * @property {string | null} name
 * @property {string | null} startDate
 * @property {string | null} endDate
 * @property {HoldingLocation} location
 * @property {HoldingAssociation[]} associations
 * @property {string[]} allowedSpecies
 * @property {HoldingMark[]} marks
 */

/**
 * @typedef {object} PaginatedResultOfHoldingDetail
 * @property {HoldingDetail[]} values
 * @property {number} count
 * @property {number} totalCount
 * @property {number} page
 * @property {number} pageSize
 * @property {number} totalPages
 * @property {boolean} hasNextPage
 * @property {boolean} hasPreviousPage
 * @property {string | null} nextCursor
 */

/**
 * @typedef {object} HoldingSearch
 * @property {string} search
 * @property {number} page
 * @property {number} pageSize
 * @property {'asc' | 'desc'} sort
 * @property {'cph' | 'identifier' | 'name' | 'holdingType' | 'startDate' | 'endDate'} order
 */

/**
 * @param {Location} record
 * @returns {HoldingDetail} the record without the fields only other fakes read
 */
function toHoldingDetail(record) {
  return {
    identifier: record.identifier,
    holdingType: record.holdingType,
    name: record.name,
    startDate: record.startDate,
    endDate: record.endDate,
    location: record.location,
    associations: record.associations,
    allowedSpecies: record.allowedSpecies,
    marks: record.marks
  }
}

/**
 * @param {string} county
 * @param {string} parish
 * @param {string} holding
 * @returns {HoldingDetail | undefined} the HoldingDetail body, or undefined if the
 *   CPH isn't recognised
 */
export function findHolding(county, parish, holding) {
  const record = findLocation(`${county}/${parish}/${holding}`)

  return record ? toHoldingDetail(record) : undefined
}

const CPH_WITH_SLASHES = /^\d{2}\/\d{3}\/\d{4}$/
const CPH_NINE_DIGITS = /^\d{9}$/
const WORD = /[\p{L}\p{N}]+/gu

/**
 * @param {string | null | undefined} phone
 * @returns {string} the number without spaces, hyphens, plus signs or brackets
 */
function stripPhone(phone) {
  return (phone ?? '').replace(/[\s\-+()]/g, '')
}

/**
 * Lower-cases and strips diacritics, as FTS5's unicode61 tokenizer does.
 *
 * @param {string} text
 * @returns {string[]} the runs of letters and digits in the text
 */
function words(text) {
  return (
    text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().match(WORD) ?? []
  )
}

/**
 * Mirrors the text keeper-data-api's FTS5 index holds per holding
 * (HoldingSearchIndex), tokenised as unicode61 does: lower-cased runs of
 * letters and digits.
 *
 * @param {Location} record
 * @returns {string[]}
 */
function searchTokens(record) {
  const { address } = record.location
  const text = [
    record.identifier,
    record.identifier.replaceAll('/', ''),
    record.name,
    record.holdingType,
    address.udprn,
    address.addressLine1,
    address.addressLine2,
    address.locality,
    address.postTown,
    address.postcode,
    (address.postcode ?? '').replaceAll(' ', ''),
    record.location.osMapReference,
    ...record.associations.flatMap((association) => [
      association.customerNumber,
      association.name,
      association.title,
      association.firstName,
      association.lastName,
      association.email,
      association.mobile,
      stripPhone(association.mobile),
      association.telephone,
      stripPhone(association.telephone)
    ])
  ].join(' ')

  return words(text)
}

/**
 * Mirrors keeper-data-api's ToFtsQuery: a full CPH (with or without slashes)
 * must match exactly; otherwise every word in the term must prefix some
 * indexed word.
 *
 * @param {Location} record
 * @param {string} term - trimmed and non-empty
 * @returns {boolean}
 */
function matches(record, term) {
  const tokens = searchTokens(record)

  if (CPH_WITH_SLASHES.test(term) || CPH_NINE_DIGITS.test(term)) {
    return tokens.includes(term.replaceAll('/', ''))
  }

  const termWords = words(term)
  return (
    termWords.length > 0 &&
    termWords.every((word) => tokens.some((token) => token.startsWith(word)))
  )
}

/**
 * @param {HoldingSearch['order']} order
 * @returns {(record: Location) => string | null}
 */
function sortKey(order) {
  const field = order === 'cph' ? 'identifier' : order
  return (record) => record[field]
}

/**
 * Orders as SQLite does for keeper-data-api's ORDER BY: nulls first ascending,
 * last descending, with CPH as a tie-break in the same direction.
 *
 * @param {HoldingSearch['order']} order
 * @param {HoldingSearch['sort']} sort
 * @returns {(a: Location, b: Location) => number}
 */
function compareBy(order, sort) {
  const key = sortKey(order)
  const direction = sort === 'desc' ? -1 : 1
  const compareKeys = (
    /** @type {string | null} */ keyA,
    /** @type {string | null} */ keyB
  ) => {
    if (keyA === keyB) {
      return 0
    }
    if (keyA === null) {
      return -1
    }
    if (keyB === null) {
      return 1
    }
    return keyA < keyB ? -1 : 1
  }

  return (a, b) =>
    direction *
    (compareKeys(key(a), key(b)) || compareKeys(a.identifier, b.identifier))
}

/**
 * @param {HoldingSearch} query
 * @returns {PaginatedResultOfHoldingDetail} the requested page of matching
 *   holdings, or of every holding when the search is blank
 */
export function searchHoldings({ search, page, pageSize, sort, order }) {
  const term = search.trim()

  const matching = allLocations()
    .filter((record) => term === '' || matches(record, term))
    .sort(compareBy(order, sort))

  const totalCount = matching.length
  const totalPages = Math.ceil(totalCount / pageSize)
  const values = matching
    .slice((page - 1) * pageSize, page * pageSize)
    .map(toHoldingDetail)

  return {
    values,
    count: values.length,
    totalCount,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    nextCursor: null
  }
}
