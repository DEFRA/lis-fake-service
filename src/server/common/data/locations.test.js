import { describe, expect, test } from 'vitest'

import { findLocation, holdingId, isKnownCph } from './locations.js'

describe('findLocation()', () => {
  test('it returns the record for a recognised active holding', () => {
    // Act
    const location = findLocation('22/001/0001')

    // Assert
    expect(location).toEqual({ status: 'active' })
  })

  test('it returns the override record for a CPH with a non-default status', () => {
    // Act
    const location = findLocation('22/008/0008')

    // Assert
    expect(location).toMatchObject({ status: 'cancelled' })
  })

  test('it returns undefined for an unrecognised CPH', () => {
    // Act
    const location = findLocation('99/999/9999')

    // Assert
    expect(location).toBeUndefined()
  })
})

describe('isKnownCph()', () => {
  test('it is true for a recognised holding with animals', () => {
    // Act
    const result = isKnownCph('22/001/0001')

    // Assert
    expect(result).toBe(true)
  })

  test('it is true for a recognised holding with no animals', () => {
    // Act
    const result = isKnownCph('22/099/0099')

    // Assert
    expect(result).toBe(true)
  })

  test('it is true for a cancelled holding', () => {
    // Act
    const result = isKnownCph('22/008/0008')

    // Assert
    expect(result).toBe(true)
  })

  test('it is false for an unrecognised CPH', () => {
    // Act
    const result = isKnownCph('99/999/9999')

    // Assert
    expect(result).toBe(false)
  })
})

describe('holdingId()', () => {
  test('it returns a stable v5 UUID for a recognised holding', () => {
    // Act
    const first = holdingId('22/001/0001')
    const second = holdingId('22/001/0001')

    // Assert
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
    expect(first).toBe(second)
  })

  test('it returns a different id per CPH', () => {
    // Act
    const a = holdingId('22/001/0001')
    const b = holdingId('22/002/0002')

    // Assert
    expect(a).not.toBe(b)
  })

  test('it returns undefined for an unrecognised CPH', () => {
    // Act
    const result = holdingId('99/999/9999')

    // Assert
    expect(result).toBeUndefined()
  })
})
