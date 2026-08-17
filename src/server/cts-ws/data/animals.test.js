import { describe, expect, test } from 'vitest'

import { findAnimal, hasAnimalOnHolding, isKnownEarTag } from './animals.js'

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

  test('hasAnimalOnHolding returns true for a CPH with an animal on it', () => {
    // Act
    const result = hasAnimalOnHolding('22/001/0001')

    // Assert
    expect(result).toBe(true)
  })

  test('hasAnimalOnHolding returns false for a CPH with no animal on it', () => {
    // Act
    const result = hasAnimalOnHolding('99/999/9999')

    // Assert
    expect(result).toBe(false)
  })

  test('findAnimal returns the full animal record for a known ear tag', () => {
    // Act
    const animal = findAnimal('UK200000000001')

    // Assert
    expect(animal).toEqual({
      ear_tag: 'UK200000000001',
      sex: 'm',
      breed: 'AA',
      dob: '2023-02-01',
      current_cph: '22/001/0001'
    })
  })

  test('findAnimal returns undefined for an unknown ear tag', () => {
    // Act
    const animal = findAnimal('UK999999999999')

    // Assert
    expect(animal).toBeUndefined()
  })
})
