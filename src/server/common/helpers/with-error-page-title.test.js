import { describe, expect, test } from 'vitest'

import { withErrorPageTitle } from './with-error-page-title.js'

describe('withErrorPageTitle()', () => {
  test('it returns the title unchanged when there are no errors', () => {
    // Act
    const result = withErrorPageTitle('My Page')

    // Assert
    expect(result).toBe('My Page')
  })

  test('it returns the title unchanged when errors is an empty object', () => {
    // Act
    const result = withErrorPageTitle('My Page', {})

    // Assert
    expect(result).toBe('My Page')
  })

  test('it prefixes the title with Error: when errors are present', () => {
    // Act
    const result = withErrorPageTitle('My Page', { field: 'is required' })

    // Assert
    expect(result).toBe('Error: My Page')
  })
})
