import { isValidBreedCode } from '../data/breed-codes.js'
import { findAnimal } from '../data/animals.js'
import { isIssuedAndUnused } from '../data/unused-ear-tags.js'

const EAR_TAG_FORMAT = /^[A-Za-z]{2}\d{12}$/
const CPH_FORMAT = /^\d{2}\/\d{3}\/\d{4}$/
const ISO_DATE_LENGTH = 10

const MS_PER_DAY = 86_400_000
const DAYS_PER_MONTH = 30.44
const DAYS_PER_YEAR = 365.25
const MIN_DAM_AGE_MONTHS = 15
const MAX_DAM_AGE_YEARS = 20
const CALVING_WINDOW_DAYS = 240
const EXCESSIVE_CALVING_THRESHOLD = 3

function daysBetween(fromIso, toIso) {
  return (new Date(toIso) - new Date(fromIso)) / MS_PER_DAY
}

function recentCalvingCount(dam, row) {
  return (dam.calving_dates ?? []).filter((calvingDate) => {
    const daysSince = daysBetween(calvingDate, row.Dob)
    return daysSince >= 0 && daysSince <= CALVING_WINDOW_DAYS
  }).length
}

function isDuplicateEtg(row, rows) {
  const rowIndex = rows.indexOf(row)
  return rows.slice(0, rowIndex).some((other) => other.Etg === row.Etg)
}

function tagsMatch(a, b) {
  return Boolean(a) && a === b
}

/**
 * Each cause pairs the real CTWS code/message/severity/field with a
 * predicate deciding whether it applies to a submitted birth row, following
 * the same independently self-guarding, multi-cause-capable pattern as
 * movementCauses (see validation/movement.js) - causes on different fields
 * can co-occur, matching the real service's observed behaviour (e.g.
 * CTWS200 + CTWS203 together on one rejected row).
 */
export const birthCauses = [
  {
    code: 'CTWS003',
    desc: 'Missing Ear Tag',
    sev: 'e',
    field: 'Etg',
    validate: (row) => !row.Etg
  },
  {
    code: 'CTWS004',
    desc: 'Invalid Ear Tag. Format must be: AANNNNNNNNNNNN',
    sev: 'e',
    field: 'Etg',
    validate: (row) => Boolean(row.Etg) && !EAR_TAG_FORMAT.test(row.Etg)
  },
  {
    code: 'CTWS044',
    desc: 'Invalid Sire Ear Tag',
    sev: 'e',
    field: 'SiEtg',
    validate: (row) => Boolean(row.SiEtg) && !EAR_TAG_FORMAT.test(row.SiEtg)
  },
  {
    code: 'CTWS023',
    desc: 'Birth Date cannot be in the future',
    sev: 'e',
    field: 'Dob',
    validate: (row) =>
      row.Dob > new Date().toISOString().slice(0, ISO_DATE_LENGTH)
  },
  {
    code: 'CTWS034',
    desc: 'Genetic Dam and Animal Ear Tags match',
    sev: 'e',
    field: 'GdEtg',
    validate: (row) => tagsMatch(row.GdEtg, row.Etg)
  },
  {
    code: 'CTWS042',
    desc: 'Surrogate Dam and Animal Ear Tags match',
    sev: 'e',
    field: 'SuEtg',
    validate: (row) => tagsMatch(row.SuEtg, row.Etg)
  },
  {
    code: 'CTWS043',
    desc: 'Surrogate and Genetic Dam Ear Tags match',
    sev: 'e',
    field: 'SuEtg',
    validate: (row) => tagsMatch(row.SuEtg, row.GdEtg)
  },
  {
    code: 'CTWS050',
    desc: 'Sire and Animal Ear Tags match',
    sev: 'e',
    field: 'SiEtg',
    validate: (row) => tagsMatch(row.SiEtg, row.Etg)
  },
  {
    code: 'CTWS051',
    desc: 'Sire and Genetic Dam Ear Tags match',
    sev: 'e',
    field: 'SiEtg',
    validate: (row) => tagsMatch(row.SiEtg, row.GdEtg)
  },
  {
    code: 'CTWS052',
    desc: 'Sire and Surrogate Dam Ear Tags match',
    sev: 'e',
    field: 'SiEtg',
    validate: (row) => tagsMatch(row.SiEtg, row.SuEtg)
  },
  {
    code: 'CTWS070',
    desc: 'Invalid Postal Location',
    sev: 'e',
    field: 'PLoc',
    validate: (row) => Boolean(row.PLoc) && !CPH_FORMAT.test(row.PLoc)
  },
  {
    code: 'CTWS079',
    desc: 'Invalid Birth Location',
    sev: 'e',
    field: 'BLoc',
    validate: (row) => Boolean(row.BLoc) && !CPH_FORMAT.test(row.BLoc)
  },
  {
    code: 'CTWS014',
    desc: 'Invalid Breed Code',
    sev: 'e',
    field: 'Brd',
    validate: (row) => Boolean(row.Brd) && !isValidBreedCode(row.Brd)
  },
  {
    code: 'CTWS180',
    desc: 'Birth Dam Ear Tag not found',
    sev: 'w',
    field: 'GdEtg',
    validate: (row) => Boolean(row.GdEtg) && !findAnimal(row.GdEtg)
  },
  {
    code: 'CTWS111',
    desc: 'Ear Tag not issued',
    sev: 'e',
    field: 'Etg',
    validate: (row) =>
      Boolean(row.Etg) &&
      EAR_TAG_FORMAT.test(row.Etg) &&
      !findAnimal(row.Etg) &&
      !isIssuedAndUnused(row.BLoc, row.Etg)
  },
  {
    code: 'CTWS192',
    desc: 'Ear Tag has already been used',
    sev: 'e',
    field: 'Etg',
    validate: (row) => Boolean(row.Etg) && Boolean(findAnimal(row.Etg))
  },
  {
    code: 'CTWS195',
    desc: "Dam's sex is invalid",
    sev: 'e',
    field: 'GdEtg',
    validate: (row) => findAnimal(row.GdEtg)?.sex === 'm'
  },
  {
    code: 'CTWS196',
    desc: "Sire's sex is invalid",
    sev: 'w',
    field: 'SiEtg',
    validate: (row) => findAnimal(row.SiEtg)?.sex === 'f'
  },
  {
    code: 'CTWS198',
    desc: 'Dam is dead on birth date',
    sev: 'e',
    field: 'GdEtg',
    validate: (row) => {
      const dam = findAnimal(row.GdEtg)
      return Boolean(dam?.dead_on) && row.Dob >= dam.dead_on
    }
  },
  {
    code: 'CTWS199',
    desc: 'Dam was not on location at birth date',
    sev: 'e',
    field: 'GdEtg',
    validate: (row) => {
      const dam = findAnimal(row.GdEtg)
      return Boolean(dam) && dam.current_cph !== row.BLoc
    }
  },
  {
    code: 'CTWS200',
    desc: 'Dam has already given birth',
    sev: 'w',
    field: 'GdEtg',
    validate: (row) => {
      const dam = findAnimal(row.GdEtg)
      return Boolean(dam) && recentCalvingCount(dam, row) >= 1
    }
  },
  {
    code: 'CTWS202',
    desc: 'Dam is too old or too young',
    sev: 'e',
    field: 'GdEtg',
    validate: (row) => {
      const dam = findAnimal(row.GdEtg)

      if (!dam) {
        return false
      }

      const ageInDays = daysBetween(dam.dob, row.Dob)

      return (
        ageInDays < MIN_DAM_AGE_MONTHS * DAYS_PER_MONTH ||
        ageInDays > MAX_DAM_AGE_YEARS * DAYS_PER_YEAR
      )
    }
  },
  {
    code: 'CTWS204',
    desc: 'Duplicate Ear Tag in file',
    sev: 'e',
    field: 'Etg',
    validate: (row, rows) => isDuplicateEtg(row, rows)
  },
  {
    code: 'CTWS209',
    desc: 'Multiple calvings have occurred',
    sev: 'w',
    field: 'GdEtg',
    validate: (row) => {
      const dam = findAnimal(row.GdEtg)
      return (
        Boolean(dam) &&
        recentCalvingCount(dam, row) > EXCESSIVE_CALVING_THRESHOLD
      )
    }
  }
]

/**
 * Validates a single submitted birth row's content against every known
 * CTWS cause, returning every cause whose predicate matches.
 *
 * @param {Record<string, string>} row
 * @param {Record<string, string>[]} rows - every row in the batch, for
 *   causes (CTWS204) that need cross-row context.
 * @returns {{code: string, desc: string, sev: string, field: string}[]}
 */
export function validateBirthRow(row, rows) {
  return birthCauses
    .filter((cause) => cause.validate(row, rows))
    .map(({ code, desc, sev, field }) => ({ code, desc, sev, field }))
}
