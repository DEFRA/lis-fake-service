import { allAnimals, animalsByEarTag } from '../../common/data/animals.js'
import { findLocation } from '../../common/data/locations.js'
import { breedName } from '../../common/data/breeds.js'

/** @import { Animal } from '../../common/data/animals.js' */

const EAR_TAG_SCHEMA = 'uk.gov.defra.ear-tag.conventional'

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

const DEFAULT_EAR_STATUS = 'Passport Produced'

/**
 * Maps a canonical animal to an "animals on holding" list item. status is the
 * CTS CP.EARSTATUS long description.
 *
 * @param {Animal} animal
 * @returns {object}
 */
function toListItem(animal) {
  return {
    identifier: { schema: EAR_TAG_SCHEMA, identifier: animal.earTag },
    birthDate: animal.birthDate,
    dateOnCPH: animal.dateOnCph,
    dateOffCPH: null,
    species: 'Cattle',
    sex: animal.sex,
    breedCode: breedCode(animal),
    status: animal.earStatus ?? DEFAULT_EAR_STATUS
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

// Keyed by the lower-cased AnimalOrderBy enum member name.
const SORT_ACCESSORS = {
  identifier: (animal) => animal.earTag,
  birthdate: (animal) => animal.birthDate,
  dateoncph: (animal) => animal.dateOnCph,
  sex: (animal) => animal.sex,
  breedcode: (animal) => animal.breedCode
}

// Stand-in for Postgres's C collation: strings compare by UTF-8 bytes.
function compareValues(a, b) {
  return Buffer.compare(Buffer.from(String(a)), Buffer.from(String(b)))
}

// Nulls sort last whichever way the primary key is ordered, so the direction
// is applied to non-null comparisons only.
function compareNullsLast(a, b, sign) {
  if (a == null || b == null) {
    return Number(a == null) - Number(b == null)
  }
  return sign * compareValues(a, b)
}

const ASCENDING = 1
const DESCENDING = -1

function compareAnimals(accessor, sign, a, b) {
  return (
    compareNullsLast(accessor(a), accessor(b), sign) ||
    compareNullsLast(a.dateOnCph, b.dateOnCph, ASCENDING) ||
    compareValues(a.earTag, b.earTag)
  )
}

/**
 * Animals currently on the holding: not dead and not moved off.
 *
 * @param {object} query
 * @param {string} query.cph
 * @param {string} [query.sex] canonical Female | Male
 * @param {string} [query.breedCode] upper-case
 * @param {string} query.orderBy canonical AnimalOrderBy member
 * @param {string} query.direction canonical Asc | Desc
 * @param {number} query.page 1-indexed
 * @param {number} query.pageSize
 * @returns {{ locationName: string | null, animals: object[], totalRecords: number }}
 */
export function animalsOnHolding(query) {
  const {
    cph,
    sex,
    breedCode: breed,
    orderBy,
    direction,
    page,
    pageSize
  } = query
  const accessor = SORT_ACCESSORS[orderBy.toLowerCase()]
  const sign = direction === 'Desc' ? DESCENDING : ASCENDING

  const matching = allAnimals
    .filter(
      (animal) =>
        animal.currentCph === cph && !animal.dateOfDeath && !animal.dateOffCph
    )
    .filter((animal) => !sex || animal.sex === sex)
    .filter((animal) => !breed || animal.breedCode === breed)
    .sort((a, b) => compareAnimals(accessor, sign, a, b))

  const start = (page - 1) * pageSize
  const animals = matching.slice(start, start + pageSize).map(toListItem)

  return {
    locationName: animals.length > 0 ? (findLocation(cph)?.name ?? null) : null,
    animals,
    // CADS reads the count from the first row, so an empty page reports 0.
    totalRecords: animals.length > 0 ? matching.length : 0
  }
}

/**
 * @param {string} earTag
 * @returns {object | undefined} the inner AnimalDetail body, or undefined
 */
export function findAnimalDetail(earTag) {
  const animal = animalsByEarTag.get(earTag)
  return animal ? toDetail(animal) : undefined
}
