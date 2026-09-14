import { describe, expect, test } from 'vitest'

import {
  associationForEmail,
  cphsForEmail,
  findLocation,
  holdingId,
  isKnownCph
} from './locations.js'

describe('findLocation()', () => {
  test('it returns the record for a recognised active holding', () => {
    // Act
    const location = findLocation('22/001/0001')

    // Assert
    expect(location).toMatchObject({
      status: 'active',
      identifier: '22/001/0001'
    })
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

describe('cphsForEmail()', () => {
  test('it returns every CPH/role pair for a keeper with one holding', () => {
    // Act
    const result = cphsForEmail('oakfield.farmer@oakhill-farms.co.uk')

    // Assert
    expect(result).toEqual([{ cph: '22/001/0001', role: 'Keeper' }])
  })

  test('it returns every CPH/role pair for a keeper with multiple holdings', () => {
    // Act
    const result = cphsForEmail('fairfield.farmer@fairfield-farms.co.uk')

    // Assert
    expect(result).toEqual([
      { cph: '22/002/0002', role: 'Keeper' },
      { cph: '22/003/0003', role: 'Keeper' },
      { cph: '22/004/0004', role: 'Keeper' },
      { cph: '22/005/0005', role: 'Keeper' },
      { cph: '22/006/0006', role: 'Keeper' },
      { cph: '22/007/0007', role: 'Keeper' }
    ])
  })

  test('it returns an empty array for an email with no associations', () => {
    // Act
    const result = cphsForEmail('nobody@example.com')

    // Assert
    expect(result).toEqual([])
  })
})

describe('associationForEmail()', () => {
  test('it returns the association record for a known keeper', () => {
    // Act
    const result = associationForEmail('oakfield.farmer@oakhill-farms.co.uk')

    // Assert
    expect(result).toMatchObject({
      firstName: 'Oakfield',
      name: 'Oakfield Farmer'
    })
  })

  test('it returns undefined for an email with no associations', () => {
    // Act
    const result = associationForEmail('nobody@example.com')

    // Assert
    expect(result).toBeUndefined()
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
