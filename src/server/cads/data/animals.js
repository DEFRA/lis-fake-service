import { allAnimals, animalsByEarTag } from '../../common/data/animals.js'
import { breedName } from '../../common/data/breeds.js'

/** @import { Animal } from '../../common/data/animals.js' */

export { isKnownCph } from '../../common/data/locations.js'

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

/**
 * Maps a canonical animal to a LANI-803 "animals on holding" list item.
 *
 * @param {Animal} animal
 * @returns {object}
 */
function toListItem(animal) {
  return {
    identifier: { schema: EAR_TAG_SCHEMA, identifier: animal.earTag },
    birthDate: animal.birthDate,
    dateOnCPH: animal.dateOnCph,
    dateOffCPH: animal.dateOffCph,
    species: 'Cattle',
    sex: animal.sex,
    breedCode: breedCode(animal),
    status: animal.dateOfDeath ? 'Dead' : 'Alive'
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
    ...(animal.dateOfDeath ? { dateOfDeath: animal.dateOfDeath } : {}),
    breedCode: breedCode(animal),
    parentage: animal.parentage.map((p) => ({
      relationship: p.relationship,
      animalIdentifier: { schema: EAR_TAG_SCHEMA, identifier: p.earTag }
    })),
    state: animal.dateOfDeath ? 'Dead' : 'Alive',
    restrictionStatus: animal.restrictionStatus
  }
}

/**
 * @param {string} cph
 * @returns {object[]} the animals on the holding, as LANI-803 list items
 */
export function animalsForCph(cph) {
  return allAnimals
    .filter((animal) => animal.currentCph === cph)
    .map(toListItem)
}

/**
 * @param {string} earTag
 * @returns {object | undefined} the inner AnimalDetail body, or undefined
 */
export function findAnimalDetail(earTag) {
  const animal = animalsByEarTag.get(earTag)
  return animal ? toDetail(animal) : undefined
}
