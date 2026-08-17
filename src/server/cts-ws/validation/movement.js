import { isKnownEarTag } from '../data/animals.js'
import { findLocation } from '../data/locations.js'

const CPH_FORMAT = /^\d{2}\/\d{3}\/\d{4}$/
const ISO_DATE_LENGTH = 10

const DUPLICATE_KEY_FIELDS = [
  'Etg',
  'EId',
  'Loc',
  'SLoc',
  'MDate',
  'MType',
  'RefNum',
  'IWarn'
]

function isWithinInactiveWindow(date, record) {
  return date >= record.inactiveFrom && date <= record.inactiveTo
}

function subLocationOf(row) {
  return findLocation(row.Loc)?.subLocations?.[row.SLoc]
}

function buildDuplicateKey(row) {
  return DUPLICATE_KEY_FIELDS.map((name) => row[name] ?? '').join('|')
}

// A row is a duplicate once the same content (by DUPLICATE_KEY_FIELDS) has
// already appeared earlier in the batch - the first occurrence is never a
// duplicate of itself.
function isDuplicateOccurrence(row, rows) {
  const key = buildDuplicateKey(row)
  const rowIndex = rows.indexOf(row)
  return rows
    .slice(0, rowIndex)
    .some((other) => buildDuplicateKey(other) === key)
}

/**
 * Each cause pairs the real CTWS code/message/severity/field with a
 * predicate deciding whether it applies to a submitted row. Every predicate
 * is independently self-guarding (via optional chaining or its own format
 * check) so that mutually exclusive states of the same field - e.g. a
 * malformed Loc vs. an unrecognised one - never fire together, while causes
 * on different fields can co-occur, matching the real service's observed
 * behaviour of returning multiple simultaneous causes on one rejected row.
 */
export const movementCauses = [
  {
    code: 'CTWS307',
    desc: 'Ear Tag Not Found',
    sev: 'e',
    field: 'Etg',
    validate: (row) => !isKnownEarTag(row.Etg)
  },
  {
    code: 'CTWS320',
    desc: 'Location Unsuitable for Movements',
    sev: 'e',
    field: 'Loc',
    validate: (row) => findLocation(row.Loc)?.status === 'unsuitable'
  },
  {
    code: 'CTWS321',
    desc: 'Invalid Location',
    sev: 'e',
    field: 'Loc',
    validate: (row) => !CPH_FORMAT.test(row.Loc)
  },
  {
    code: 'CTWS324',
    desc: 'Missing Sub-Location',
    sev: 'e',
    field: 'Loc',
    validate: (row) =>
      Boolean(findLocation(row.Loc)?.requiresSubLocation) && !row.SLoc
  },
  {
    code: 'CTWS327',
    desc: 'Location not found',
    sev: 'e',
    field: 'Loc',
    validate: (row) => CPH_FORMAT.test(row.Loc) && !findLocation(row.Loc)
  },
  {
    code: 'CTWS328',
    desc: 'Location Inactive on Movement Date',
    sev: 'w',
    field: 'Loc',
    validate: (row) => {
      const location = findLocation(row.Loc)
      return (
        location?.status === 'inactive' &&
        isWithinInactiveWindow(row.MDate, location)
      )
    }
  },
  {
    code: 'CTWS329',
    desc: 'Cancelled Location',
    sev: 'w',
    field: 'Loc',
    validate: (row) => findLocation(row.Loc)?.status === 'cancelled'
  },
  {
    code: 'CTWS330',
    desc: 'Sublocation not found',
    sev: 'e',
    field: 'Loc',
    validate: (row) =>
      Boolean(row.SLoc) &&
      Boolean(findLocation(row.Loc)?.subLocations) &&
      !subLocationOf(row)
  },
  {
    code: 'CTWS331',
    desc: 'Sublocation Inactive on Movement Date',
    sev: 'w',
    field: 'Loc',
    validate: (row) => {
      const subLocation = subLocationOf(row)
      return (
        subLocation?.status === 'inactive' &&
        isWithinInactiveWindow(row.MDate, subLocation)
      )
    }
  },
  {
    code: 'CTWS332',
    desc: 'Cancelled Sublocation',
    sev: 'w',
    field: 'Loc',
    validate: (row) => subLocationOf(row)?.status === 'cancelled'
  },
  {
    code: 'CTWS335',
    desc: 'Movement Date cannot be in the future',
    sev: 'e',
    field: 'MDate',
    validate: (row) =>
      row.MDate > new Date().toISOString().slice(0, ISO_DATE_LENGTH)
  },
  {
    code: 'CTWS336',
    desc: 'Duplicate movement in file',
    sev: 'w',
    field: 'Etg',
    validate: (row, rows) => isDuplicateOccurrence(row, rows)
  }
]

/**
 * Validates a single submitted movement row's content against every known
 * CTWS cause, returning every cause whose predicate matches.
 *
 * @param {Record<string, string>} row
 * @param {Record<string, string>[]} rows - every row in the batch, for
 *   causes (CTWS336) that need cross-row context.
 * @returns {{code: string, desc: string, sev: string, field: string}[]}
 */
export function validateMovementRow(row, rows) {
  return movementCauses
    .filter((cause) => cause.validate(row, rows))
    .map(({ code, desc, sev, field }) => ({ code, desc, sev, field }))
}
