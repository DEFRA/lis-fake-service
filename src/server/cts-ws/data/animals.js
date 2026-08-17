import animals from '../../../../data/fixtures/cts-animals.json' with { type: 'json' }

const animalsByEarTag = new Map(
  animals.map((animal) => [animal.ear_tag, animal])
)
const cphsWithAnimals = new Set(animals.map((animal) => animal.current_cph))

/**
 * @param {string} earTag
 * @returns {boolean}
 */
export function isKnownEarTag(earTag) {
  return animalsByEarTag.has(earTag)
}

/**
 * @param {string} earTag
 * @returns {{ear_tag: string, sex: string, breed: string, dob: string, current_cph: string, dead_on?: string, calving_dates?: string[]} | undefined}
 */
export function findAnimal(earTag) {
  return animalsByEarTag.get(earTag)
}

/**
 * @param {string} cph
 * @returns {boolean}
 */
export function hasAnimalOnHolding(cph) {
  return cphsWithAnimals.has(cph)
}
