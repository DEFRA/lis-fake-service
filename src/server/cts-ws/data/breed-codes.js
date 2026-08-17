import breedCodes from '../../../../data/fixtures/cts-breed-codes.json' with { type: 'json' }

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isValidBreedCode(code) {
  return (
    breedCodes.includes(code) ||
    (code?.endsWith('X') && breedCodes.includes(code.slice(0, -1)))
  )
}
