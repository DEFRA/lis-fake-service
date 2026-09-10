import { animalsByEarTag } from '../../common/data/animals.js'

/** @import { Animal } from '../../common/data/animals.js' */

/**
 * @param {string} earTag
 * @returns {boolean}
 */
export function isKnownEarTag(earTag) {
  return animalsByEarTag.has(earTag)
}

/**
 * @param {string} earTag
 * @returns {Animal | undefined}
 */
export function findAnimal(earTag) {
  return animalsByEarTag.get(earTag)
}
