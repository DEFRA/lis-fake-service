import { afterEach, describe, expect, test, vi } from 'vitest'

describe('findHolding', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  test('it fills the missing fields of a partial correspondence address with null', async () => {
    // Arrange
    vi.stubEnv(
      'FAKE_LOCATIONS',
      JSON.stringify([
        {
          identifier: '03/202/0021',
          status: 'active',
          location: {
            address: { postcode: 'AB1 2CD' },
            correspondenceAddress: { postcode: 'EF3 4GH' }
          },
          associations: []
        }
      ])
    )
    vi.resetModules()
    const { findHolding } = await import('./holdings.js')

    // Act
    const holding = findHolding('03', '202', '0021')

    // Assert
    expect(holding.location.correspondenceAddress).toEqual({
      udprn: null,
      addressLine1: null,
      addressLine2: null,
      postTown: null,
      locality: null,
      postcode: 'EF3 4GH',
      country: null
    })
  })

  test('it returns a location record that has no location block without one', async () => {
    // Arrange
    vi.stubEnv(
      'FAKE_LOCATIONS',
      JSON.stringify([
        { identifier: '03/202/0021', status: 'inactive', associations: [] }
      ])
    )
    vi.resetModules()
    const { findHolding } = await import('./holdings.js')

    // Act
    const holding = findHolding('03', '202', '0021')

    // Assert
    expect(holding.identifier).toBe('03/202/0021')
    expect(holding.location).toBeUndefined()
  })
})
