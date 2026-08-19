import { describe, expect, test } from 'vitest'

import { getOperation } from './index.js'

describe('getOperation()', () => {
  test('it returns the operation module for a known type', () => {
    // Act
    const operation = getOperation('Register_Births_Asynchronous-V1-0')

    // Assert
    expect(operation.type).toBe('Register_Births_Asynchronous-V1-0')
    expect(typeof operation.handle).toBe('function')
  })

  test('it returns undefined for an unknown type', () => {
    // Act
    const operation = getOperation('Not_A_Real_Type')

    // Assert
    expect(operation).toBeUndefined()
  })
})
