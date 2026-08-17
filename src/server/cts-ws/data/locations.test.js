import { describe, expect, test } from 'vitest'

import { findLocation } from './locations.js'

describe('findLocation()', () => {
  test('findLocation returns a default active location for a CPH with an animal and no override', () => {
    // Act
    const location = findLocation('22/001/0001')

    // Assert
    expect(location).toEqual({ status: 'active' })
  })

  test('findLocation returns the override record for a CPH with a location override', () => {
    // Act
    const location = findLocation('22/008/0008')

    // Assert
    expect(location).toEqual({ status: 'cancelled' })
  })

  test('findLocation returns undefined for a CPH with no animal and no override', () => {
    // Act
    const location = findLocation('99/999/9999')

    // Assert
    expect(location).toBeUndefined()
  })
})
