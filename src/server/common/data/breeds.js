import breedNames from '../../../../data/fixtures/breed-names.json' with { type: 'json' }

// The GOV.UK "Official cattle breeds and codes" list, keyed by code. Every
// base breed and its `X` cross variant is listed explicitly. Shared by the
// cts-ws breed-code validation and the cads breedName hydration.
// https://www.gov.uk/guidance/official-cattle-breeds-and-codes

/**
 * @param {string} code
 * @returns {boolean} whether the code is an official GOV.UK cattle breed code
 */
export function isKnownBreedCode(code) {
  return Object.hasOwn(breedNames, code)
}

/**
 * @param {string} code
 * @returns {string} the breed name for the code, or the code itself if unknown
 */
export function breedName(code) {
  return breedNames[code] ?? code
}
