import { breeds } from '@defra/lis-species-cattle'

// The GOV.UK "Official cattle breeds and codes" list, keyed by code, from
// @defra/lis-species-cattle. Shared by the cts-ws breed-code validation and
// the cads breedName hydration. Lookups are exact-case, as CTS validates codes.
// https://www.gov.uk/guidance/official-cattle-breeds-and-codes

/**
 * @param {string} code
 * @returns {boolean} whether the code is an official GOV.UK cattle breed code
 */
export function isKnownBreedCode(code) {
  return Object.hasOwn(breeds, code)
}

/**
 * @param {string} code
 * @returns {string} the breed name for the code, or the code itself if unknown
 */
export function breedName(code) {
  return Object.hasOwn(breeds, code) ? breeds[code] : code
}
