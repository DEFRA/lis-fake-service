import { describe, expect, test } from 'vitest'

import { isIssuedAndUnused } from './unused-ear-tags.js'

describe('isIssuedAndUnused()', () => {
  test('isIssuedAndUnused returns true for a tag issued and unused at a known CPH', () => {
    // Act
    const result = isIssuedAndUnused('22/001/0001', 'UK100000000001')

    // Assert
    expect(result).toBe(true)
  })

  test('isIssuedAndUnused returns false for a tag not issued at a known CPH', () => {
    // Act
    const result = isIssuedAndUnused('22/001/0001', 'UK999999999999')

    // Assert
    expect(result).toBe(false)
  })

  test('isIssuedAndUnused returns false for a CPH with no issued-tag pool', () => {
    // Act
    const result = isIssuedAndUnused('22/002/0002', 'UK100000000001')

    // Assert
    expect(result).toBe(false)
  })
})
