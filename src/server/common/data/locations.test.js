import { describe, expect, test } from 'vitest'

import {
  cphsForEmail,
  findLocation,
  holdingId,
  isKnownCph,
  withPeople
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
    const result = cphsForEmail('defralivestock+oakfield@gmail.com')

    // Assert
    expect(result).toEqual([{ cph: '22/001/0001', role: 'owner' }])
  })

  test('it returns every CPH/role pair for a keeper with multiple holdings', () => {
    // Act
    const result = cphsForEmail('defralivestock+fairfield@gmail.com')

    // Assert
    expect(result).toEqual([
      { cph: '22/002/0002', role: 'owner' },
      { cph: '22/003/0003', role: 'owner' },
      { cph: '22/004/0004', role: 'owner' },
      { cph: '22/005/0005', role: 'owner' },
      { cph: '22/006/0006', role: 'owner' },
      { cph: '22/007/0007', role: 'owner' }
    ])
  })

  test('it returns an empty array for an email with no associations', () => {
    // Act
    const result = cphsForEmail('nobody@example.com')

    // Assert
    expect(result).toEqual([])
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

describe('withPeople()', () => {
  test('it fills in each association from the person it references', () => {
    // Arrange
    const location = {
      identifier: '11/111/1111',
      associations: [
        {
          customerNumber: 'CUST9001',
          roles: [{ code: 'owner', species: ['Cattle'] }]
        }
      ]
    }
    const people = new Map([
      [
        'CUST9001',
        {
          customerNumber: 'CUST9001',
          name: 'Test Person',
          address: { addressTown: 'Testville' }
        }
      ]
    ])

    // Act
    const result = withPeople(location, people)

    // Assert
    expect(result.associations).toEqual([
      {
        customerNumber: 'CUST9001',
        name: 'Test Person',
        address: { addressTown: 'Testville' },
        roles: [{ code: 'owner', species: ['Cattle'] }]
      }
    ])
  })

  test('it throws when an association references an unknown person', () => {
    // Arrange
    const location = {
      identifier: '11/111/1111',
      associations: [{ customerNumber: 'CUST9999', roles: [] }]
    }
    const people = new Map()

    // Act
    let error
    try {
      withPeople(location, people)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error.message).toBe('11/111/1111 references unknown person CUST9999')
  })

  test('it gives a person on several holdings the same details on each', () => {
    // Act
    const addresses = ['22/002/0002', '22/007/0007'].map(
      (cph) => findLocation(cph).associations[0].address
    )

    // Assert
    expect(addresses[0]).toEqual(addresses[1])
    expect(addresses[0].addressLine1).toBe('Fairfield Farmhouse')
  })
})
