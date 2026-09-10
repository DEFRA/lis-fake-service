import { describe, expect, test } from 'vitest'

import { breedName, isKnownBreedCode } from './breeds.js'

describe('isKnownBreedCode()', () => {
  test('it returns true for a known base breed code', () => {
    // Act
    const result = isKnownBreedCode('HF')

    // Assert
    expect(result).toBe(true)
  })

  test('it returns true for a known cross-breed code', () => {
    // Act
    const result = isKnownBreedCode('HFX')

    // Assert
    expect(result).toBe(true)
  })

  test('it returns false for an unrecognised code', () => {
    // Act
    const result = isKnownBreedCode('ZZ')

    // Assert
    expect(result).toBe(false)
  })
})

describe('breedName()', () => {
  test('it returns the breed name for a known code', () => {
    // Act
    const result = breedName('HF')

    // Assert
    expect(result).toBe('Holstein Friesian')
  })

  test('it falls back to the code itself for an unknown code', () => {
    // Act
    const result = breedName('ZZ')

    // Assert
    expect(result).toBe('ZZ')
  })
})
