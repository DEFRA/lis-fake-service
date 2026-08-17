import { describe, expect, test } from 'vitest'

import { validateMovementRow } from './movement.js'

const validAttributes = {
  Etg: 'UK200000000001',
  Loc: '22/001/0001',
  MDate: '2020-01-01',
  MType: 'on',
  RefNum: '1',
  IWarn: 'n'
}

describe('validateMovementRow()', () => {
  test('validateMovementRow accepts a row with a known ear tag and an active, suitable location', () => {
    // Arrange
    const attributes = { ...validAttributes }

    // Act
    const causes = validateMovementRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([])
  })

  test('validateMovementRow rejects an unrecognised ear tag as CTWS307', () => {
    // Arrange
    const attributes = { ...validAttributes, Etg: 'UK999999999999' }

    // Act
    const causes = validateMovementRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      { code: 'CTWS307', desc: 'Ear Tag Not Found', sev: 'e', field: 'Etg' }
    ])
  })

  test('validateMovementRow rejects a malformed location as CTWS321', () => {
    // Arrange
    const attributes = { ...validAttributes, Loc: '1234567890' }

    // Act
    const causes = validateMovementRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      { code: 'CTWS321', desc: 'Invalid Location', sev: 'e', field: 'Loc' }
    ])
  })

  test('validateMovementRow rejects a well-formed but unrecognised location as CTWS327', () => {
    // Arrange
    const attributes = { ...validAttributes, Loc: '99/999/9999' }

    // Act
    const causes = validateMovementRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      { code: 'CTWS327', desc: 'Location not found', sev: 'e', field: 'Loc' }
    ])
  })

  test('validateMovementRow rejects a cancelled location as CTWS329', () => {
    // Arrange
    const attributes = { ...validAttributes, Loc: '22/008/0008' }

    // Act
    const causes = validateMovementRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      { code: 'CTWS329', desc: 'Cancelled Location', sev: 'w', field: 'Loc' }
    ])
  })

  test('validateMovementRow rejects a location inactive on the movement date as CTWS328', () => {
    // Arrange
    const attributes = { ...validAttributes, Loc: '22/009/0009' }

    // Act
    const causes = validateMovementRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS328',
        desc: 'Location Inactive on Movement Date',
        sev: 'w',
        field: 'Loc'
      }
    ])
  })

  test('validateMovementRow rejects a location unsuitable for movements as CTWS320', () => {
    // Arrange
    const attributes = { ...validAttributes, Loc: '22/010/0010' }

    // Act
    const causes = validateMovementRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS320',
        desc: 'Location Unsuitable for Movements',
        sev: 'e',
        field: 'Loc'
      }
    ])
  })

  test('validateMovementRow rejects a missing sub-location where one is required as CTWS324', () => {
    // Arrange
    const attributes = { ...validAttributes, Loc: '22/011/0011' }

    // Act
    const causes = validateMovementRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS324',
        desc: 'Missing Sub-Location',
        sev: 'e',
        field: 'Loc'
      }
    ])
  })

  test('validateMovementRow accepts a known, active sub-location', () => {
    // Arrange
    const attributes = { ...validAttributes, Loc: '22/011/0011', SLoc: '01' }

    // Act
    const causes = validateMovementRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([])
  })

  test('validateMovementRow rejects an unrecognised sub-location as CTWS330', () => {
    // Arrange
    const attributes = { ...validAttributes, Loc: '22/011/0011', SLoc: '99' }

    // Act
    const causes = validateMovementRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS330',
        desc: 'Sublocation not found',
        sev: 'e',
        field: 'Loc'
      }
    ])
  })

  test('validateMovementRow rejects a cancelled sub-location as CTWS332', () => {
    // Arrange
    const attributes = { ...validAttributes, Loc: '22/011/0011', SLoc: '02' }

    // Act
    const causes = validateMovementRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS332',
        desc: 'Cancelled Sublocation',
        sev: 'w',
        field: 'Loc'
      }
    ])
  })

  test('validateMovementRow rejects a sub-location inactive on the movement date as CTWS331', () => {
    // Arrange
    const attributes = { ...validAttributes, Loc: '22/011/0011', SLoc: '03' }

    // Act
    const causes = validateMovementRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS331',
        desc: 'Sublocation Inactive on Movement Date',
        sev: 'w',
        field: 'Loc'
      }
    ])
  })

  test('validateMovementRow rejects a movement date in the future as CTWS335', () => {
    // Arrange
    const attributes = { ...validAttributes, MDate: '2099-01-01' }

    // Act
    const causes = validateMovementRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS335',
        desc: 'Movement Date cannot be in the future',
        sev: 'e',
        field: 'MDate'
      }
    ])
  })

  test('validateMovementRow accepts the first occurrence of duplicated content and rejects the second as CTWS336', () => {
    // Arrange
    const firstOccurrence = { ...validAttributes }
    const secondOccurrence = { ...validAttributes }
    const rows = [firstOccurrence, secondOccurrence]

    // Act
    const firstCauses = validateMovementRow(firstOccurrence, rows)
    const secondCauses = validateMovementRow(secondOccurrence, rows)

    // Assert
    expect(firstCauses).toEqual([])
    expect(secondCauses).toEqual([
      {
        code: 'CTWS336',
        desc: 'Duplicate movement in file',
        sev: 'w',
        field: 'Etg'
      }
    ])
  })

  test('validateMovementRow returns causes on more than one field at once when both fail', () => {
    // Arrange
    const attributes = {
      ...validAttributes,
      Etg: 'UK999999999999',
      MDate: '2099-01-01'
    }

    // Act
    const causes = validateMovementRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      { code: 'CTWS307', desc: 'Ear Tag Not Found', sev: 'e', field: 'Etg' },
      {
        code: 'CTWS335',
        desc: 'Movement Date cannot be in the future',
        sev: 'e',
        field: 'MDate'
      }
    ])
  })
})
