import { describe, expect, test } from 'vitest'
import { compileSearch } from './holdings-search.js'

/** @import { Location } from '../../common/data/locations.js' */

/**
 * @param {Partial<Location> & { address?: object, associations?: object[], marks?: object[] }} overrides
 * @returns {Location}
 */
function location({ address = {}, associations = [], marks = [], ...rest }) {
  return /** @type {Location} */ ({
    identifier: '47/215/0169',
    name: 'Low Wood Farm',
    location: {
      address: {
        addressLine1: 'Low Wood Farm',
        addressLine2: 'Blow Wood Lane',
        postTown: 'Carlisle',
        locality: 'Cumbria',
        postcode: 'CA5 7LD',
        ...address
      }
    },
    associations,
    marks,
    ...rest
  })
}

describe('compileSearch', () => {
  describe('business names', () => {
    test('it matches an organisation party by the prefix of its name', () => {
      // Arrange
      const record = location({
        associations: [
          { partyType: 'Organisation', name: 'UK Farming Ltd' },
          { partyType: 'Individual', name: 'Sheila Keeper' }
        ]
      })

      // Act
      const result = compileSearch('UK Farming')(record)

      // Assert
      expect(result).toBe(true)
    })

    test('it matches a second organisation party, held on its own index row', () => {
      // Arrange
      const record = location({
        associations: [
          { partyType: 'Organisation', name: 'Low Wood Farming' },
          { partyType: 'Organisation', name: 'Oakfield Livestock' }
        ]
      })

      // Act
      const result = compileSearch('Oakfield Live')(record)

      // Assert
      expect(result).toBe(true)
    })

    test('it does not join two organisation names into one phrase', () => {
      // Arrange
      const record = location({
        name: null,
        address: { addressLine1: null, addressLine2: null },
        associations: [
          { partyType: 'Organisation', name: 'Low' },
          { partyType: 'Organisation', name: 'Wood' }
        ]
      })

      // Act
      const result = compileSearch('Low Wood')(record)

      // Assert
      expect(result).toBe(false)
    })

    test('it does not match an individual party by name', () => {
      // Arrange
      const record = location({
        associations: [{ partyType: 'Individual', name: 'Sheila Keeper' }]
      })

      // Act
      const result = compileSearch('Sheila')(record)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('herd marks', () => {
    test('it matches a second herd mark in every form', () => {
      // Arrange
      const record = location({
        marks: [{ mark: 'UK 123456' }, { mark: 'UK 654322' }]
      })

      // Act
      const results = ['UK 654322', 'UK654322', 'uk654322', '654322'].map(
        (term) => compileSearch(term)(record)
      )

      // Assert
      expect(results).toEqual([true, true, true, true])
    })

    test('it indexes a mark recorded without the UK prefix under both forms', () => {
      // Arrange
      const record = location({ marks: [{ mark: '123456' }] })

      // Act
      const results = ['UK 123456', '123456'].map((term) =>
        compileSearch(term)(record)
      )

      // Assert
      expect(results).toEqual([true, true])
    })

    test('it does not match a UK herd mark search against an address number', () => {
      // Arrange
      const record = location({
        address: { addressLine1: '123456 Main Street' },
        marks: []
      })

      // Act
      const result = compileSearch('UK 123456')(record)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('general terms', () => {
    test('it treats UK on its own as a general term, not a herd mark', () => {
      // Arrange
      const record = location({
        associations: [{ partyType: 'Organisation', name: 'UK Farming Ltd' }]
      })

      // Act
      const result = compileSearch('UK')(record)

      // Assert
      expect(result).toBe(true)
    })

    test('it does not let a literal match in another field bypass the word boundary', () => {
      // Arrange
      const record = location({
        name: 'Low & Wood Farm',
        address: { addressLine1: null, addressLine2: 'Blow Wood Lane' }
      })

      // Act
      const result = compileSearch('Low Wood')(record)

      // Assert
      expect(result).toBe(false)
    })

    test('it matches a phrase only within one field', () => {
      // Arrange
      const record = location({
        name: null,
        address: { addressLine1: 'Low Field', addressLine2: 'Wood Farm' }
      })

      // Act
      const result = compileSearch('Low Wood')(record)

      // Assert
      expect(result).toBe(false)
    })

    test('it treats a postcode-shaped term that is not a postcode as a prefix search', () => {
      // Arrange
      const record = location({ address: { postcode: 'CA5 7LD' } })

      // Act
      const result = compileSearch('ca57')(record)

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('CPH forms', () => {
    test('it matches every form of the full CPH', () => {
      // Arrange
      const record = location({})

      // Act
      const results = ['47/215/0169', '472150169', '47 215 0169'].map((term) =>
        compileSearch(term)(record)
      )

      // Assert
      expect(results).toEqual([true, true, true])
    })

    test('it matches the parish and holding on their own', () => {
      // Arrange
      const record = location({})

      // Act
      const results = ['215/0169', '215 0169', '0169'].map((term) =>
        compileSearch(term)(record)
      )

      // Assert
      expect(results).toEqual([true, true, true])
    })
  })

  describe('sparse and malformed fixture data', () => {
    test('it indexes a CPH that is not in three parts as its text and digits only', () => {
      // Arrange
      const record = location({ identifier: '12/345' })

      // Act
      const results = ['12345', '12/345'].map((term) =>
        compileSearch(term)(record)
      )

      // Assert
      expect(results).toEqual([true, true])
    })

    test('it indexes a short spaced postcode by its last part', () => {
      // Arrange
      const record = location({ address: { postcode: 'W1 1' } })

      // Act
      const result = compileSearch('1')(record)

      // Assert
      expect(result).toBe(true)
    })

    test('it indexes a short unspaced postcode as itself', () => {
      // Arrange
      const record = location({ address: { postcode: 'W11' } })

      // Act
      const result = compileSearch('W11')(record)

      // Assert
      expect(result).toBe(true)
    })

    test('it ignores a blank herd mark', () => {
      // Arrange
      const record = location({ marks: [{ mark: '   ' }, { mark: null }] })

      // Act
      const result = compileSearch('UK')(record)

      // Assert
      expect(result).toBe(false)
    })

    test('it ignores an organisation party with no name', () => {
      // Arrange
      const record = location({
        name: null,
        address: {
          addressLine1: null,
          addressLine2: null,
          postTown: null,
          locality: null,
          postcode: null
        },
        associations: [{ partyType: 'Organisation', name: null }],
        marks: undefined
      })

      // Act
      const result = compileSearch('Farm')(record)

      // Assert
      expect(result).toBe(false)
    })

    test('it matches nothing for a term with no letters or digits', () => {
      // Arrange
      const record = location({})

      // Act
      const result = compileSearch('/ / -')(record)

      // Assert
      expect(result).toBe(false)
    })
  })
})
