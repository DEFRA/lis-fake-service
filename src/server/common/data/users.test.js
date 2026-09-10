import { describe, expect, test } from 'vitest'

import { findUser, userId } from './users.js'

const OAKFIELD_EMAIL = 'oakfield.farmer@oakhill-farms.co.uk'

describe('userId()', () => {
  test('it derives a stable v5 UUID from the email', () => {
    // Act
    const first = userId(OAKFIELD_EMAIL)
    const second = userId(OAKFIELD_EMAIL)

    // Assert
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
    expect(first).toBe(second)
  })
})

describe('findUser()', () => {
  test('it returns the record, keyed by the derived id, for a known user', () => {
    // Act
    const user = findUser(userId(OAKFIELD_EMAIL))

    // Assert
    expect(user).toMatchObject({
      id: userId(OAKFIELD_EMAIL),
      email: OAKFIELD_EMAIL,
      firstName: 'Oakfield',
      displayName: 'Oakfield Farmer',
      active: true,
      cphs: [{ cph: '22/001/0001', role: 'Keeper' }]
    })
  })

  test('it returns undefined for an unknown id', () => {
    // Act
    const user = findUser('not-a-real-id')

    // Assert
    expect(user).toBeUndefined()
  })
})
