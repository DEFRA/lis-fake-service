import { describe, expect, test } from 'vitest'

import { parseCtsOlUser } from './parse-cts-ol-user.js'

describe('parseCtsOlUser()', () => {
  test('it extracts the CTS_OL_User Usr and Pwd attributes', () => {
    // Arrange
    const authentication = {
      CTS_OL_User: { '@_Usr': 'cts-ol-user', '@_Pwd': 'cts-ol-pass' }
    }

    // Act
    const result = parseCtsOlUser(authentication)

    // Assert
    expect(result).toEqual({ username: 'cts-ol-user', password: 'cts-ol-pass' })
  })

  test('it returns undefined fields when Authentication is missing', () => {
    // Arrange
    // Act
    const result = parseCtsOlUser(undefined)

    // Assert
    expect(result).toEqual({ username: undefined, password: undefined })
  })
})
