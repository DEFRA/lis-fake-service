import { allAnimals, animalsByEarTag } from '../../common/data/animals.js'
import { breedName } from '../../common/data/breeds.js'

/** @import { Animal } from '../../common/data/animals.js' */

export { isKnownCph } from '../../common/data/locations.js'

const EAR_TAG_SCHEMA = 'uk.gov.defra.ear-tag.conventional'

const MOVED_ON_HOLDING = 'MovedOnHolding'
const REGISTERED_ON_HOLDING = 'RegisteredOnHolding'
const HOLDING_ASSOCIATIONS = new Set([MOVED_ON_HOLDING, REGISTERED_ON_HOLDING])

/**
 * @param {Animal} animal
 * @returns {{ schema: string, breedName: string, identifier: string }}
 */
function breedCode(animal) {
  return {
    schema: 'cts.breed',
    breedName: breedName(animal.breedCode),
    identifier: animal.breedCode
  }
}

// ICAR lifecycle status (LANI-803): Alive, Dead, OffFarm, Unknown. This fake
// never has cause to report Unknown - every animal in the canonical data has
// a definite state.
function statusFor(animal) {
  if (animal.dateOfDeath) {
    return 'Dead'
  }
  return animal.dateOffCph ? 'OffFarm' : 'Alive'
}

// dateOnCPH means different things depending on holdingAssociation: the
// movement date, or the registration date. The canonical animal record only
// has one location, so both associations return the same animals for a
// given CPH - they differ only in which date is reported.
function dateOnCphFor(animal, holdingAssociation) {
  return holdingAssociation === REGISTERED_ON_HOLDING
    ? animal.registrationDate
    : animal.dateOnCph
}

/**
 * Maps a canonical animal to a LANI-803 "animals on holding" list item.
 *
 * @param {Animal} animal
 * @param {string} holdingAssociation
 * @returns {object}
 */
function toListItem(animal, holdingAssociation) {
  return {
    identifier: { schema: EAR_TAG_SCHEMA, identifier: animal.earTag },
    birthDate: animal.birthDate,
    dateOnCPH: dateOnCphFor(animal, holdingAssociation),
    dateOffCPH: animal.dateOffCph,
    species: 'Cattle',
    sex: animal.sex,
    breedCode: breedCode(animal),
    status: statusFor(animal)
  }
}

/**
 * Maps a canonical animal to the inner LANI-802 AnimalDetail body.
 *
 * @param {Animal} animal
 * @returns {object}
 */
function toDetail(animal) {
  return {
    resourceType: 'Animal',
    identifier: { schema: EAR_TAG_SCHEMA, identifier: animal.earTag },
    species: 'Cattle',
    sex: animal.sex,
    birthDate: animal.birthDate,
    registrationDate: animal.registrationDate,
    dateOnCph: animal.dateOnCph,
    breedCode: breedCode(animal),
    parentage: animal.parentage.map((p) => ({
      relationship: p.relationship,
      animalIdentifier: { schema: EAR_TAG_SCHEMA, identifier: p.earTag }
    })),
    state: animal.dateOfDeath ? 'Dead' : 'Alive',
    restrictionStatus: animal.restrictionStatus
  }
}

// Matches the real cads-data-service AnimalOrderBy enum's member names
// (case-insensitively, as ASP.NET's query-string enum binding does).
const SORT_ACCESSORS = {
  identifier: (item) => item.identifier.identifier,
  birthdate: (item) => item.birthDate,
  dateoncph: (item) => item.dateOnCPH,
  sex: (item) => item.sex,
  breedcode: (item) => item.breedCode.identifier
}

const DATE_SORT_KEYS = new Set(['birthdate', 'dateoncph'])
const EAR_TAG_ACCESSOR = SORT_ACCESSORS.identifier

// The real implementation always ties-break by ear tag ascending
// (AnimalsOnCphSorting.TieBreak), whatever the primary sort column is.
function compareItems(orderBy, direction, a, b) {
  const key = orderBy?.toLowerCase()
  const accessor = SORT_ACCESSORS[key] ?? EAR_TAG_ACCESSOR
  const [valueA, valueB] = [accessor(a), accessor(b)]
  const primaryComparison = DATE_SORT_KEYS.has(key)
    ? new Date(valueA) - new Date(valueB)
    : String(valueA).localeCompare(String(valueB))

  const comparison =
    primaryComparison !== 0
      ? primaryComparison
      : EAR_TAG_ACCESSOR(a).localeCompare(EAR_TAG_ACCESSOR(b))

  return direction?.toLowerCase() === 'desc' ? -comparison : comparison
}

function matchesOneOf(value, wantedValues) {
  return (
    wantedValues.length === 0 ||
    wantedValues.some(
      (wanted) => wanted.toLowerCase() === (value ?? '').toLowerCase()
    )
  )
}

function matchesDateOnCphFrom(item, dateOnCPHFrom) {
  return (
    !dateOnCPHFrom ||
    (item.dateOnCPH && new Date(item.dateOnCPH) >= new Date(dateOnCPHFrom))
  )
}

// "an animal is returned where the term matches any one of" ear tag (partial),
// sex (whole value only) or breed (exact code, or any part of the breed
// name) - LANI-803 / AnimalsOnCphFilters.Apply.
function matchesSearch(item, q) {
  if (!q) {
    return true
  }

  const term = q.toLowerCase()
  const earTagMatches = item.identifier.identifier.toLowerCase().includes(term)
  const sexMatches = (item.sex ?? '').toLowerCase() === term
  const breedMatches =
    item.breedCode.identifier.toLowerCase() === term ||
    item.breedCode.breedName.toLowerCase().includes(term)

  return earTagMatches || sexMatches || breedMatches
}

/**
 * @param {string} cph
 * @param {object} [options]
 * @param {string} [options.holdingAssociation] MovedOnHolding (default) or RegisteredOnHolding
 * @param {string[]} [options.status]
 * @param {string} [options.sex]
 * @param {string[]} [options.breedCode]
 * @param {string} [options.dateOnCPHFrom]
 * @param {string} [options.q] free-text search
 * @param {string} [options.orderBy]
 * @param {string} [options.direction]
 * @returns {object[]} the animals on the holding, filtered and sorted, as LANI-803 list items
 */
export function animalsForCph(cph, options = {}) {
  const {
    holdingAssociation,
    status = [],
    sex,
    breedCode: breedCodes = [],
    dateOnCPHFrom,
    q,
    orderBy,
    direction
  } = options

  const association = HOLDING_ASSOCIATIONS.has(holdingAssociation)
    ? holdingAssociation
    : MOVED_ON_HOLDING

  const items = allAnimals
    .filter((animal) => animal.currentCph === cph)
    .map((animal) => toListItem(animal, association))
    .filter((item) => item.dateOnCPH != null)
    .filter((item) => matchesOneOf(item.status, status))
    .filter((item) => matchesOneOf(item.sex, sex ? [sex] : []))
    .filter((item) => matchesOneOf(item.breedCode.identifier, breedCodes))
    .filter((item) => matchesDateOnCphFrom(item, dateOnCPHFrom))
    .filter((item) => matchesSearch(item, q))

  return items.sort((a, b) => compareItems(orderBy, direction, a, b))
}

/**
 * @param {string} earTag
 * @returns {object | undefined} the inner AnimalDetail body, or undefined
 */
export function findAnimalDetail(earTag) {
  const animal = animalsByEarTag.get(earTag)
  return animal ? toDetail(animal) : undefined
}
