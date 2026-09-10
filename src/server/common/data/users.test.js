import { describe, expect, test } from 'vitest'

import { findUser } from './users.js'

const OAKFIELD_EMAIL = 'oakfield.farmer@oakhill-farms.co.uk'
const OAKFIELD_SUB = 'cd91b1e0-bae4-4cee-becf-3529cc557311'

describe('findUser()', () => {
  test('it returns the record, keyed by the IdP-issued sub, for a known user', () => {
    // Act
    const user = findUser(OAKFIELD_SUB)

    // Assert
    expect(user).toMatchObject({
      sub: OAKFIELD_SUB,
      email: OAKFIELD_EMAIL,
      firstName: 'Oakfield',
      displayName: 'Oakfield Farmer',
      active: true,
      cphs: [{ cph: '22/001/0001', role: 'Keeper' }]
    })
  })

  test('it returns undefined for an unknown sub', () => {
    // Act
    const user = findUser('not-a-real-id')

    // Assert
    expect(user).toBeUndefined()
  })
})
