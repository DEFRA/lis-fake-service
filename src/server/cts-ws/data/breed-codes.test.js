import { describe, expect, test } from 'vitest'

import { isValidBreedCode } from './breed-codes.js'

describe('isValidBreedCode()', () => {
  test('isValidBreedCode returns true for a known base breed code', () => {
    // Act
    const result = isValidBreedCode('HF')

    // Assert
    expect(result).toBe(true)
  })

  test('isValidBreedCode returns true for a known cross-breed code', () => {
    // Act
    const result = isValidBreedCode('HFX')

    // Assert
    expect(result).toBe(true)
  })

  test('isValidBreedCode returns false for an unrecognised code', () => {
    // Act
    const result = isValidBreedCode('ZZ')

    // Assert
    expect(result).toBe(false)
  })
})
