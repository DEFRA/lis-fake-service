/** @import { Location } from '../../common/data/locations.js' */

// --- Holdings search -------------------------------------------------------
//
// Mirrors keeper-data-api's holdings search (HoldingSearchIndex and
// HoldingDetailRepository on its dev branch, Oct 2026). Each holding is
// indexed as one or more FTS5 rows with the columns Cph, HoldingName,
// BusinessName, AddressLine1, AddressLine2, Town, Locality, Postcode and
// Herdmark: a primary row carrying every field, plus one extra row per
// additional business name or herd mark. Party names, emails, phone
// numbers, UDPRN and holding type are no longer indexed. The query is
// classified (full CPH, partial CPH, UK herd mark, postcode, or general
// terms) into FTS5 phrase-prefix alternatives, and general terms must also
// appear literally, at a word boundary, in one of the stored fields.
//
// keeper-data-api also indexes aliases for numbered addresses (SAON/PAON
// start and end numbers and suffixes). The fixtures hold plain address
// lines, so there is nothing to alias here.

const FULL_CPH = /^\d{2}[/\s]*\d{3}[/\s]*\d{4}$/
const PARTIAL_CPH = /^(\d{3})[/\s]+(\d{4})$/
// keeper-data-api's: ^UK\s*([0-9A-Za-z]*[0-9][0-9A-Za-z]*)$, written without the
// backtracking - an alphanumeric run that contains at least one digit.
const UK_HERD_MARK = /^UK\s*((?=[a-z\d]*\d)[a-z\d]+)$/i
const UK_POSTCODE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/
const COUNTY_DIGITS = 2
const PARISH_END = 5
const INWARD_CODE_LENGTH = 3
const UK_PREFIX_LENGTH = 2
const CPH_PARTS = 3
const WORD = /[\p{L}\p{N}]+/gu

/** @typedef {'cph' | 'holdingName' | 'businessName' | 'addressLine1' | 'addressLine2' | 'town' | 'locality' | 'postcode' | 'herdmark'} IndexColumn */
/** @typedef {Record<IndexColumn, string>} IndexRow */
/** @typedef {{ column?: IndexColumn, tokens: string[] }} PhrasePrefix */

/** @type {IndexColumn[]} */
const COLUMNS = [
  'cph',
  'holdingName',
  'businessName',
  'addressLine1',
  'addressLine2',
  'town',
  'locality',
  'postcode',
  'herdmark'
]

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
 * @param {string} cph
 * @returns {string} the CPH forms keeper-data-api indexes
 */
function formatCphTokens(cph) {
  const digits = cph.replaceAll('/', '')
  const parts = cph.split('/')
  if (parts.length === CPH_PARTS) {
    const [, parish, holding] = parts
    return `${cph} ${digits} ${holding} ${parish}/${holding} ${parish}${holding}`
  }
  return `${cph} ${digits}`
}

/**
 * @param {string} postcode
 * @returns {string} the postcode forms keeper-data-api indexes
 */
function formatPostcodeTokens(postcode) {
  const unspaced = postcode.replaceAll(' ', '').trim()
  const tokens = [postcode, unspaced]
  if (unspaced.length > INWARD_CODE_LENGTH) {
    const inward = unspaced.slice(-INWARD_CODE_LENGTH)
    const outward = unspaced.slice(0, -INWARD_CODE_LENGTH)
    tokens.push(inward, `${outward} ${inward}`)
  } else if (postcode.includes(' ')) {
    tokens.push(postcode.split(' ').findLast(Boolean) ?? '')
  } else {
    // a short postcode without a space has no separate inward code
  }
  return [...new Set(tokens.filter((t) => t.trim()))].join(' ')
}

/**
 * @param {string} raw
 * @returns {string} the herd mark forms keeper-data-api indexes
 */
function formatHerdMarkToken(raw) {
  const mark = raw.trim()
  if (!mark) {
    return ''
  }
  const unspaced = mark.replaceAll(' ', '')
  if (mark.toUpperCase().startsWith('UK')) {
    return `${mark} ${unspaced} ${mark.slice(UK_PREFIX_LENGTH).trim()}`
  }
  return `${mark} ${unspaced} UK ${mark} UK${unspaced}`
}

/** @returns {IndexRow} */
function emptyRow() {
  return /** @type {IndexRow} */ (
    Object.fromEntries(COLUMNS.map((column) => [column, '']))
  )
}

/**
 * The FTS5 rows keeper-data-api would hold for a holding.
 *
 * @param {Location} record
 * @returns {IndexRow[]}
 */
function indexRows(record) {
  const { address } = record.location
  // keeper-data-api indexes each distinct OrganisationName of the holding's
  // parties; the fixtures' organisations carry theirs as `name`.
  const businessNames = [
    ...new Set(
      record.associations
        .filter((association) => association.partyType === 'Organisation')
        .map((association) => association.name?.trim() ?? '')
        .filter(Boolean)
    )
  ]
  const herdMarks = (record.marks ?? [])
    .map((mark) => mark.mark?.trim() ?? '')
    .filter(Boolean)

  const primary = {
    ...emptyRow(),
    cph: formatCphTokens(record.identifier),
    holdingName: record.name ?? '',
    businessName: businessNames[0] ?? '',
    addressLine1: address.addressLine1 ?? '',
    addressLine2: address.addressLine2 ?? '',
    town: address.postTown ?? '',
    locality: address.locality ?? '',
    postcode: address.postcode ? formatPostcodeTokens(address.postcode) : '',
    herdmark: herdMarks[0] ? formatHerdMarkToken(herdMarks[0]) : ''
  }

  return [
    primary,
    ...businessNames
      .slice(1)
      .map((businessName) => ({ ...emptyRow(), businessName })),
    ...herdMarks
      .slice(1)
      .map((mark) => ({ ...emptyRow(), herdmark: formatHerdMarkToken(mark) }))
  ]
}

/**
 * FTS5 `"a b c"*`: the phrase's tokens appear consecutively, the last one as
 * a prefix.
 *
 * @param {string[]} tokens
 * @param {string[]} phrase
 * @returns {boolean}
 */
function hasPhrasePrefix(tokens, phrase) {
  if (phrase.length === 0) {
    return false
  }
  const last = phrase.length - 1
  for (let start = 0; start + last < tokens.length; start++) {
    const body = phrase
      .slice(0, last)
      .every((word, offset) => tokens[start + offset] === word)
    if (body && tokens[start + last].startsWith(phrase[last])) {
      return true
    }
  }
  return false
}

/**
 * @param {IndexRow} row
 * @param {PhrasePrefix} alternative
 * @returns {boolean}
 */
function rowMatchesPhrase(row, alternative) {
  const columns = alternative.column ? [alternative.column] : COLUMNS
  return columns.some((column) =>
    hasPhrasePrefix(words(row[column]), alternative.tokens)
  )
}

/**
 * keeper-data-api's holding_contains_term: the term appears in the stored
 * field, case-insensitively, starting at a word boundary. FTS5 drops
 * punctuation, so this is what stops "Low Wood" matching "Blow Wood" or
 * "Low & Wood".
 *
 * @param {string} value
 * @param {string} term
 * @returns {boolean}
 */
function containsLiteralTerm(value, term) {
  if (!value || !term) {
    return false
  }
  const haystack = value.toLowerCase()
  const needle = term.toLowerCase()
  let offset = 0
  while (offset <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, offset)
    if (index < 0) {
      return false
    }
    if (index === 0 || !/[\p{L}\p{N}]/u.test(haystack[index - 1])) {
      return true
    }
    offset = index + 1
  }
  return false
}

/**
 * Mirrors keeper-data-api's ToFtsQuery: classifies the search term into
 * FTS5 phrase-prefix alternatives, and for general terms also requires the
 * literal text to appear in a stored field.
 *
 * @param {string} search - trimmed and non-empty
 * @returns {{ alternatives: PhrasePrefix[], literal: string | null }}
 */
function toQuery(search) {
  const full = FULL_CPH.exec(search)
  if (full) {
    const digits = search.replace(/\D/g, '')
    const county = digits.slice(0, COUNTY_DIGITS)
    const parish = digits.slice(COUNTY_DIGITS, PARISH_END)
    const holding = digits.slice(PARISH_END)
    // keeper-data-api's third alternative is an exact `Cph : "digits"`; as a
    // prefix it is subsumed by the second, so the result is the same.
    return {
      alternatives: [
        { tokens: [county, parish, holding] },
        { tokens: [digits] },
        { column: 'cph', tokens: [digits] }
      ],
      literal: null
    }
  }

  const partial = PARTIAL_CPH.exec(search)
  if (partial) {
    const [, parish, holding] = partial
    return {
      alternatives: [
        { tokens: [parish, holding] },
        { tokens: [`${parish}${holding}`] }
      ],
      literal: null
    }
  }

  const herd = UK_HERD_MARK.exec(search)
  if (herd) {
    const value = herd[1]
    return {
      alternatives: [
        { tokens: words(search) },
        { column: 'herdmark', tokens: words(`UK ${value}`) },
        { column: 'herdmark', tokens: words(`UK${value}`) },
        { column: 'herdmark', tokens: words(value) }
      ],
      literal: null
    }
  }

  if (UK_POSTCODE.test(search)) {
    const unspaced = search.replaceAll(' ', '').toUpperCase()
    let spaced = search.toUpperCase()
    if (!spaced.includes(' ') && unspaced.length > INWARD_CODE_LENGTH) {
      spaced = `${unspaced.slice(0, -INWARD_CODE_LENGTH)} ${unspaced.slice(-INWARD_CODE_LENGTH)}`
    }
    return {
      alternatives: [{ tokens: words(spaced) }, { tokens: words(unspaced) }],
      literal: null
    }
  }

  const terms = words(search)
  return { alternatives: [{ tokens: terms }], literal: search }
}

/**
 * Parses the search term once and returns the predicate to filter holdings
 * with.
 *
 * @param {string} term - trimmed and non-empty
 * @returns {(record: Location) => boolean}
 */
export function compileSearch(term) {
  const { alternatives, literal } = toQuery(term)
  if (alternatives.every((alternative) => alternative.tokens.length === 0)) {
    return () => false
  }

  return (record) =>
    indexRows(record).some(
      (row) =>
        alternatives.some((alternative) =>
          rowMatchesPhrase(row, alternative)
        ) &&
        (literal === null ||
          COLUMNS.some((column) => containsLiteralTerm(row[column], literal)))
    )
}
