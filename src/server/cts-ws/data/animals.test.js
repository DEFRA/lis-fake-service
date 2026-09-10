import { describe, expect, test } from 'vitest'

import { findAnimal, isKnownEarTag } from './animals.js'

describe('animals', () => {
  test('isKnownEarTag returns true for an ear tag present in the fixture', () => {
    // Act
    const result = isKnownEarTag('UK200000000001')

    // Assert
    expect(result).toBe(true)
  })

  test('isKnownEarTag returns false for an ear tag not present in the fixture', () => {
    // Act
    const result = isKnownEarTag('UK999999999999')

    // Assert
    expect(result).toBe(false)
  })

  test('findAnimal returns the full canonical animal record for a known ear tag', () => {
    // Act
    const animal = findAnimal('UK200000000001')

    // Assert
    expect(animal).toMatchObject({
      earTag: 'UK200000000001',
      sex: 'Male',
      breedCode: 'AA',
      birthDate: '2023-02-01',
      currentCph: '22/001/0001'
    })
  })

  test('findAnimal returns undefined for an unknown ear tag', () => {
    // Act
    const animal = findAnimal('UK999999999999')

    // Assert
    expect(animal).toBeUndefined()
  })
})
