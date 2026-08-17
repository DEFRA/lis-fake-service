import { describe, expect, test } from 'vitest'

import { validateBirthRow } from './birth.js'

const validAttributes = {
  Etg: 'UK100000000001',
  Dob: '2026-01-01',
  Brd: 'HF',
  Sex: 'f',
  GdEtg: '',
  SuEtg: '',
  SiEtg: '',
  BLoc: '22/001/0001',
  PLoc: '22/001/0001',
  IWarn: 'n'
}

describe('validateBirthRow()', () => {
  test('validateBirthRow accepts a row with no matching cause', () => {
    // Arrange
    const attributes = { ...validAttributes }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([])
  })

  test('validateBirthRow rejects a missing ear tag as CTWS003', () => {
    // Arrange
    const attributes = { ...validAttributes, Etg: '' }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      { code: 'CTWS003', desc: 'Missing Ear Tag', sev: 'e', field: 'Etg' }
    ])
  })

  test('validateBirthRow rejects a malformed ear tag as CTWS004', () => {
    // Arrange
    const attributes = { ...validAttributes, Etg: 'not-a-tag' }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS004',
        desc: 'Invalid Ear Tag. Format must be: AANNNNNNNNNNNN',
        sev: 'e',
        field: 'Etg'
      }
    ])
  })

  test('validateBirthRow rejects a malformed sire ear tag as CTWS044', () => {
    // Arrange
    const attributes = { ...validAttributes, SiEtg: 'not-a-tag' }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS044',
        desc: 'Invalid Sire Ear Tag',
        sev: 'e',
        field: 'SiEtg'
      }
    ])
  })

  test('validateBirthRow rejects a birth date in the future as CTWS023', () => {
    // Arrange
    const attributes = { ...validAttributes, Dob: '2099-01-01' }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS023',
        desc: 'Birth Date cannot be in the future',
        sev: 'e',
        field: 'Dob'
      }
    ])
  })

  test('validateBirthRow rejects a genetic dam ear tag matching the animal as CTWS034', () => {
    // Arrange - GdEtg equal to Etg is also an unregistered tag, so CTWS180
    // (dam not found) is an unavoidable, legitimate second cause here.
    const attributes = { ...validAttributes, GdEtg: validAttributes.Etg }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS034',
        desc: 'Genetic Dam and Animal Ear Tags match',
        sev: 'e',
        field: 'GdEtg'
      },
      {
        code: 'CTWS180',
        desc: 'Birth Dam Ear Tag not found',
        sev: 'w',
        field: 'GdEtg'
      }
    ])
  })

  test('validateBirthRow rejects a surrogate dam ear tag matching the animal as CTWS042', () => {
    // Arrange
    const attributes = { ...validAttributes, SuEtg: validAttributes.Etg }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS042',
        desc: 'Surrogate Dam and Animal Ear Tags match',
        sev: 'e',
        field: 'SuEtg'
      }
    ])
  })

  test('validateBirthRow rejects a surrogate dam ear tag matching the genetic dam as CTWS043', () => {
    // Arrange - GdEtg has to be set to something for SuEtg to match it; an
    // unregistered tag also makes CTWS180 an unavoidable, legitimate second cause.
    const attributes = {
      ...validAttributes,
      GdEtg: 'UK900000000099',
      SuEtg: 'UK900000000099'
    }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS043',
        desc: 'Surrogate and Genetic Dam Ear Tags match',
        sev: 'e',
        field: 'SuEtg'
      },
      {
        code: 'CTWS180',
        desc: 'Birth Dam Ear Tag not found',
        sev: 'w',
        field: 'GdEtg'
      }
    ])
  })

  test('validateBirthRow rejects a sire ear tag matching the animal as CTWS050', () => {
    // Arrange
    const attributes = { ...validAttributes, SiEtg: validAttributes.Etg }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS050',
        desc: 'Sire and Animal Ear Tags match',
        sev: 'e',
        field: 'SiEtg'
      }
    ])
  })

  test('validateBirthRow rejects a sire ear tag matching the genetic dam as CTWS051', () => {
    // Arrange - GdEtg has to be set to something for SiEtg to match it; an
    // unregistered tag also makes CTWS180 an unavoidable, legitimate second cause.
    const attributes = {
      ...validAttributes,
      GdEtg: 'UK900000000099',
      SiEtg: 'UK900000000099'
    }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS051',
        desc: 'Sire and Genetic Dam Ear Tags match',
        sev: 'e',
        field: 'SiEtg'
      },
      {
        code: 'CTWS180',
        desc: 'Birth Dam Ear Tag not found',
        sev: 'w',
        field: 'GdEtg'
      }
    ])
  })

  test('validateBirthRow rejects a sire ear tag matching the surrogate dam as CTWS052', () => {
    // Arrange
    const attributes = {
      ...validAttributes,
      SuEtg: 'UK900000000099',
      SiEtg: 'UK900000000099'
    }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS052',
        desc: 'Sire and Surrogate Dam Ear Tags match',
        sev: 'e',
        field: 'SiEtg'
      }
    ])
  })

  test('validateBirthRow rejects a malformed postal location as CTWS070', () => {
    // Arrange
    const attributes = { ...validAttributes, PLoc: '1234567890' }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS070',
        desc: 'Invalid Postal Location',
        sev: 'e',
        field: 'PLoc'
      }
    ])
  })

  test('validateBirthRow rejects a malformed birth location as CTWS079', () => {
    // Arrange - a malformed BLoc also means the ear tag can't be verified as
    // issued there, so CTWS111 is an unavoidable, legitimate second cause.
    const attributes = { ...validAttributes, BLoc: '1234567890' }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS079',
        desc: 'Invalid Birth Location',
        sev: 'e',
        field: 'BLoc'
      },
      { code: 'CTWS111', desc: 'Ear Tag not issued', sev: 'e', field: 'Etg' }
    ])
  })

  test('validateBirthRow rejects an unrecognised breed code as CTWS014', () => {
    // Arrange
    const attributes = { ...validAttributes, Brd: 'ZZ' }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      { code: 'CTWS014', desc: 'Invalid Breed Code', sev: 'e', field: 'Brd' }
    ])
  })

  test('validateBirthRow rejects an unrecognised genetic dam ear tag as CTWS180', () => {
    // Arrange
    const attributes = { ...validAttributes, GdEtg: 'UK999999999999' }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS180',
        desc: 'Birth Dam Ear Tag not found',
        sev: 'w',
        field: 'GdEtg'
      }
    ])
  })

  test('validateBirthRow rejects a well-formed ear tag never issued to the birth location as CTWS111', () => {
    // Arrange
    const attributes = { ...validAttributes, Etg: 'UK500000000001' }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      { code: 'CTWS111', desc: 'Ear Tag not issued', sev: 'e', field: 'Etg' }
    ])
  })

  test('validateBirthRow accepts a well-formed ear tag issued and unused at the birth location', () => {
    // Arrange - UK100000000002 is issued and unused for BLoc 22/001/0001
    const attributes = { ...validAttributes, Etg: 'UK100000000002' }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([])
  })

  test('validateBirthRow rejects an ear tag already used by a known animal as CTWS192', () => {
    // Arrange
    const attributes = { ...validAttributes, Etg: 'UK200000000010' }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS192',
        desc: 'Ear Tag has already been used',
        sev: 'e',
        field: 'Etg'
      }
    ])
  })

  test('validateBirthRow rejects a genetic dam whose recorded sex is male as CTWS195', () => {
    // Arrange
    const attributes = { ...validAttributes, GdEtg: 'UK200000000002' }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS195',
        desc: "Dam's sex is invalid",
        sev: 'e',
        field: 'GdEtg'
      }
    ])
  })

  test('validateBirthRow rejects a sire whose recorded sex is female as CTWS196', () => {
    // Arrange
    const attributes = { ...validAttributes, SiEtg: 'UK200000000008' }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS196',
        desc: "Sire's sex is invalid",
        sev: 'w',
        field: 'SiEtg'
      }
    ])
  })

  test('validateBirthRow rejects a dam recorded as dead by the birth date as CTWS198', () => {
    // Arrange - UK300000000001 has dead_on 2026-01-01
    const attributes = {
      ...validAttributes,
      GdEtg: 'UK300000000001',
      Dob: '2026-06-01'
    }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS198',
        desc: 'Dam is dead on birth date',
        sev: 'e',
        field: 'GdEtg'
      }
    ])
  })

  test('validateBirthRow rejects a dam whose current holding does not match the birth location as CTWS199', () => {
    // Arrange - UK200000000013's current_cph is 22/002/0002, but BLoc stays
    // the default 22/001/0001 so the ear tag's own issued-location check
    // (CTWS111) doesn't also fire.
    const attributes = {
      ...validAttributes,
      GdEtg: 'UK200000000013'
    }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS199',
        desc: 'Dam was not on location at birth date',
        sev: 'e',
        field: 'GdEtg'
      }
    ])
  })

  test('validateBirthRow rejects a dam with a recent calving as CTWS200', () => {
    // Arrange - UK300000000002 has a calving date of 2026-05-01
    const attributes = {
      ...validAttributes,
      GdEtg: 'UK300000000002',
      Dob: '2026-06-01'
    }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS200',
        desc: 'Dam has already given birth',
        sev: 'w',
        field: 'GdEtg'
      }
    ])
  })

  test('validateBirthRow rejects a dam that is too young as CTWS202', () => {
    // Arrange - UK300000000004 has dob 2026-06-01
    const attributes = {
      ...validAttributes,
      GdEtg: 'UK300000000004',
      Dob: '2026-07-01'
    }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS202',
        desc: 'Dam is too old or too young',
        sev: 'e',
        field: 'GdEtg'
      }
    ])
  })

  test('validateBirthRow rejects a dam that is too old as CTWS202', () => {
    // Arrange - UK300000000005 has dob 1990-01-01
    const attributes = {
      ...validAttributes,
      GdEtg: 'UK300000000005',
      Dob: '2026-01-01'
    }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      {
        code: 'CTWS202',
        desc: 'Dam is too old or too young',
        sev: 'e',
        field: 'GdEtg'
      }
    ])
  })

  test('validateBirthRow rejects the second occurrence of a duplicated ear tag as CTWS204', () => {
    // Arrange
    const firstOccurrence = { ...validAttributes }
    const secondOccurrence = { ...validAttributes, GdEtg: 'UK200000000008' }
    const rows = [firstOccurrence, secondOccurrence]

    // Act
    const firstCauses = validateBirthRow(firstOccurrence, rows)
    const secondCauses = validateBirthRow(secondOccurrence, rows)

    // Assert
    expect(firstCauses).toEqual([])
    expect(secondCauses).toEqual([
      {
        code: 'CTWS204',
        desc: 'Duplicate Ear Tag in file',
        sev: 'e',
        field: 'Etg'
      }
    ])
  })

  test('validateBirthRow rejects a dam with more than three recent calvings as CTWS209', () => {
    // Arrange - UK300000000003 has four calving dates within 240 days of this Dob
    const attributes = {
      ...validAttributes,
      GdEtg: 'UK300000000003',
      Dob: '2026-05-01'
    }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toContainEqual({
      code: 'CTWS209',
      desc: 'Multiple calvings have occurred',
      sev: 'w',
      field: 'GdEtg'
    })
  })

  test('validateBirthRow returns causes on more than one field at once when both fail', () => {
    // Arrange
    const attributes = { ...validAttributes, Etg: '', Brd: 'ZZ' }

    // Act
    const causes = validateBirthRow(attributes, [attributes])

    // Assert
    expect(causes).toEqual([
      { code: 'CTWS003', desc: 'Missing Ear Tag', sev: 'e', field: 'Etg' },
      { code: 'CTWS014', desc: 'Invalid Breed Code', sev: 'e', field: 'Brd' }
    ])
  })
})
