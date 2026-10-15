import { afterEach, describe, expect, test, vi } from 'vitest'

import { logger } from '../helpers/logging/logger.js'
import { loadFixtures, parseFixtureEnv } from './fixtures.js'

const toBase64 = (/** @type {unknown} */ value) =>
  Buffer.from(JSON.stringify(value)).toString('base64')

describe('parseFixtureEnv()', () => {
  test.each([undefined, '', '   '])('it returns no records for %j', (value) => {
    // Act
    const records = parseFixtureEnv('FAKE_THINGS', value)

    // Assert
    expect(records).toEqual([])
  })

  test('it parses a raw JSON array', () => {
    // Act
    const records = parseFixtureEnv('FAKE_THINGS', '[{"id":"A"}]')

    // Assert
    expect(records).toEqual([{ id: 'A' }])
  })

  test('it parses a base64-encoded JSON array', () => {
    // Act
    const records = parseFixtureEnv('FAKE_THINGS', toBase64([{ id: 'A' }]))

    // Assert
    expect(records).toEqual([{ id: 'A' }])
  })

  test('it parses a raw JSON array with surrounding whitespace', () => {
    // Act
    const records = parseFixtureEnv('FAKE_THINGS', '\n  [{"id":"A"}]  \n')

    // Assert
    expect(records).toEqual([{ id: 'A' }])
  })

  test('it names the env var when the value is not valid JSON', () => {
    // Act / Assert
    expect(() => parseFixtureEnv('FAKE_THINGS', '[{')).toThrow(
      /^FAKE_THINGS is not valid JSON/
    )
  })

  test('it names the env var when the value is base64 of something that is not JSON', () => {
    // Act / Assert
    expect(() =>
      parseFixtureEnv('FAKE_THINGS', Buffer.from('nope').toString('base64'))
    ).toThrow(/^FAKE_THINGS is not valid JSON/)
  })

  test('it names the env var when the value is not an array', () => {
    // Act / Assert
    expect(() => parseFixtureEnv('FAKE_THINGS', toBase64({ id: 'A' }))).toThrow(
      'FAKE_THINGS must be a JSON array of records'
    )
  })
})

describe('loadFixtures()', () => {
  const options = {
    folder: 'people',
    envName: 'FAKE_PEOPLE',
    key: 'customerNumber'
  }

  test('it returns the file records when the env var is unset', () => {
    // Act
    const records = loadFixtures({ ...options, envValue: undefined })

    // Assert
    expect([...records.keys()]).toEqual(['CUST0001', 'CUST0002', 'CUST0003'])
  })

  test('it adds an env record with a new key', () => {
    // Act
    const records = loadFixtures({
      ...options,
      envValue: JSON.stringify([{ customerNumber: 'CUST0099', name: 'New' }])
    })

    // Assert
    expect(records.get('CUST0099')).toEqual({
      customerNumber: 'CUST0099',
      name: 'New'
    })
    expect(records.size).toBe(4)
  })

  test('it replaces the whole file record with an env record with the same key', () => {
    // Act
    const records = loadFixtures({
      ...options,
      envValue: JSON.stringify([{ customerNumber: 'CUST0001', name: 'Other' }])
    })

    // Assert
    expect(records.get('CUST0001')).toEqual({
      customerNumber: 'CUST0001',
      name: 'Other'
    })
    expect(records.size).toBe(3)
  })

  test('it names the env var and index when a record is missing its key', () => {
    // Act / Assert
    expect(() =>
      loadFixtures({
        ...options,
        envValue: JSON.stringify([
          { customerNumber: 'CUST0099' },
          { name: 'X' }
        ])
      })
    ).toThrow('FAKE_PEOPLE[1] is missing its "customerNumber"')
  })

  test.each([
    ['null', null],
    ['an empty key', { customerNumber: '' }],
    ['a non-string key', { customerNumber: 99 }]
  ])('it rejects a record that is %s', (_, record) => {
    // Act / Assert
    expect(() =>
      loadFixtures({ ...options, envValue: JSON.stringify([record]) })
    ).toThrow('FAKE_PEOPLE[0] is missing its "customerNumber"')
  })

  test('it keeps the last env record when the env var repeats a key', () => {
    // Act
    const records = loadFixtures({
      ...options,
      envValue: JSON.stringify([
        { customerNumber: 'CUST0099', name: 'First' },
        { customerNumber: 'CUST0099', name: 'Second' }
      ])
    })

    // Assert
    expect(records.get('CUST0099')).toEqual({
      customerNumber: 'CUST0099',
      name: 'Second'
    })
    expect(records.size).toBe(4)
  })

  describe('logging', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    test('it logs the count and size of the env records it upserted', () => {
      // Arrange
      const info = vi.spyOn(logger, 'info').mockReturnValue(undefined)
      const envValue = toBase64([
        { customerNumber: 'CUST0001' },
        { customerNumber: 'CUST0099' }
      ])

      // Act
      loadFixtures({ ...options, envValue })

      // Assert
      expect(info).toHaveBeenCalledExactlyOnceWith(
        `Upserted 2 people fixture(s) from FAKE_PEOPLE (${envValue.length} bytes)`
      )
    })

    test.each([undefined, '', '[]'])(
      'it logs nothing when the env var is %j',
      (envValue) => {
        // Arrange
        const info = vi.spyOn(logger, 'info').mockReturnValue(undefined)

        // Act
        loadFixtures({ ...options, envValue })

        // Assert
        expect(info).not.toHaveBeenCalled()
      }
    )
  })
})

describe('env-sourced fixtures in the shared loaders', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  test('an env animal is served alongside the file animals', async () => {
    // Arrange
    vi.stubEnv(
      'FAKE_ANIMALS',
      toBase64([{ earTag: 'UK999999900001', sex: 'Female' }])
    )
    vi.resetModules()

    // Act
    const { animalsByEarTag, allAnimals } = await import('./animals.js')

    // Assert
    expect(animalsByEarTag.get('UK999999900001')).toMatchObject({
      sex: 'Female'
    })
    expect(allAnimals.length).toBeGreaterThan(1)
  })

  test('an env animal replaces the file animal with the same ear tag', async () => {
    // Arrange
    const { allAnimals: fileAnimals } = await import('./animals.js')
    vi.stubEnv(
      'FAKE_ANIMALS',
      JSON.stringify([{ earTag: 'UK200000000001', sex: 'Other' }])
    )
    vi.resetModules()

    // Act
    const { animalsByEarTag, allAnimals } = await import('./animals.js')

    // Assert
    expect(animalsByEarTag.get('UK200000000001')).toStrictEqual({
      earTag: 'UK200000000001',
      sex: 'Other'
    })
    expect(allAnimals).toHaveLength(fileAnimals.length)
  })

  test('an env location replaces the file location with the same CPH and still resolves file people', async () => {
    // Arrange
    vi.stubEnv(
      'FAKE_LOCATIONS',
      JSON.stringify([
        {
          identifier: '03/202/0021',
          status: 'inactive',
          associations: [
            { customerNumber: 'CUST0001', roles: [{ code: 'keeper' }] }
          ]
        }
      ])
    )
    vi.resetModules()

    // Act
    const { findLocation } = await import('./locations.js')
    const location = findLocation('03/202/0021')

    // Assert
    expect(location).toMatchObject({ status: 'inactive' })
    expect(location).not.toHaveProperty('name')
    expect(location?.associations).toHaveLength(1)
    expect(location?.associations[0]).toMatchObject({
      customerNumber: 'CUST0001',
      email: expect.any(String)
    })
  })

  test.each([
    ['FAKE_ANIMALS', './animals.js'],
    ['FAKE_LOCATIONS', './locations.js'],
    ['FAKE_PEOPLE', './locations.js']
  ])('a malformed %s fails loading %s', async (envName, module) => {
    // Arrange
    vi.stubEnv(envName, toBase64({ not: 'an array' }))
    vi.resetModules()

    // Act / Assert
    await expect(import(module)).rejects.toThrow(
      `${envName} must be a JSON array of records`
    )
  })

  test('an env location can reference an env person', async () => {
    // Arrange
    vi.stubEnv(
      'FAKE_PEOPLE',
      JSON.stringify([{ customerNumber: 'CUST0099', email: 'new@example.com' }])
    )
    vi.stubEnv(
      'FAKE_LOCATIONS',
      JSON.stringify([
        {
          identifier: '99/999/9999',
          status: 'active',
          associations: [
            { customerNumber: 'CUST0099', roles: [{ code: 'owner' }] }
          ]
        }
      ])
    )
    vi.resetModules()

    // Act
    const { findLocation, cphsForEmail, isKnownCph } =
      await import('./locations.js')

    // Assert
    expect(findLocation('99/999/9999')?.associations[0]).toMatchObject({
      email: 'new@example.com'
    })
    expect(cphsForEmail('new@example.com')).toEqual([
      { cph: '99/999/9999', role: 'owner' }
    ])
    expect(isKnownCph('22/001/0001')).toBe(true)
  })
})
