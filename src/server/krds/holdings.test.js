import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import hapi from '@hapi/hapi'
import { config } from '../../config/config.js'
import { krds } from './index.js'

const CLIENT_ID = 'test-client'
const CLIENT_SECRET = 'test-secret'
const encodedCredentials = Buffer.from(
  `${CLIENT_ID}:${CLIENT_SECRET}`
).toString('base64')
const VALID_AUTH_HEADER = `Basic ${encodedCredentials}`

const configValues = {
  'krds.clientId': CLIENT_ID,
  'krds.clientSecret': CLIENT_SECRET
}

const mocks = {
  configGet: vi.spyOn(config, 'get')
}

async function makeServer() {
  const server = hapi.server()
  await server.register(krds)
  return server
}

const KNOWN_CPH_PATH = '/krds/api/v2/holdings/22/001/0001'
const UNKNOWN_CPH_PATH = '/krds/api/v2/holdings/99/999/9999'

describe('krds', () => {
  beforeAll(() => {
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  test('it returns 401 when the Authorization header is missing', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: KNOWN_CPH_PATH
    })

    // Assert
    expect(response.statusCode).toBe(401)
    expect(response.result.title).toBe('Unauthorized')
    expect(response.result.status).toBe(401)
  })

  test('it returns 401 when the Basic credentials are invalid', async () => {
    // Arrange
    const server = await makeServer()
    const wrongHeader = `Basic ${Buffer.from('wrong-client:wrong-secret').toString('base64')}`

    // Act
    const response = await server.inject({
      method: 'GET',
      url: KNOWN_CPH_PATH,
      headers: { authorization: wrongHeader }
    })

    // Assert
    expect(response.statusCode).toBe(401)
    expect(response.result.title).toBe('Unauthorized')
  })

  test('it returns the holding detail for a known CPH', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: KNOWN_CPH_PATH,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.identifier).toBe('22/001/0001')
    expect(response.result.name).toBe('Oakfield Farm')
    expect(response.result.location.address.postTown).toBe('Shrewsbury')
    expect(response.result.associations).toEqual([
      expect.objectContaining({
        name: 'Oakfield Farmer',
        email: 'defralivestock+oakfield@gmail.com'
      })
    ])
    expect(response.result.allowedSpecies).toEqual(['Cattle'])
    expect(response.result.marks).toHaveLength(1)
  })

  test("it returns Fairfield Farm's keeper association for 22/002/0002", async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings/22/002/0002',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.name).toBe('Fairfield Farm')
    expect(response.result.associations).toEqual([
      expect.objectContaining({
        name: 'Fairfield Farmer',
        email: 'defralivestock+fairfield@gmail.com'
      })
    ])
  })

  test('it returns a known holding with no associations when no keeper is mapped to it', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings/22/008/0008',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.associations).toEqual([])
  })

  test('it returns 404 with a problem body for an unknown CPH', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: UNKNOWN_CPH_PATH,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(404)
    expect(response.result.title).toBe('Not Found')
    expect(response.result.status).toBe(404)
    expect(response.result.detail).toBe('CPH not in the snapshot.')
  })

  test('it returns 400 with field-level errors when a segment fails its format', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings/2/001/0001',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.title).toBe('Bad Request')
    expect(response.result.errors.county).toEqual([
      'county does not match the expected CPH segment format.'
    ])
  })

  test('it returns 400 with errors for every segment that fails its format', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings/2/01/001',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(Object.keys(response.result.errors)).toEqual([
      'county',
      'parish',
      'holding'
    ])
  })

  test('it returns the first page of every holding when no search is given', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(
      expect.objectContaining({
        count: 10,
        totalCount: 13,
        page: 1,
        pageSize: 10,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
        nextCursor: null
      })
    )
    expect(response.result.values[0].identifier).toBe('03/202/0021')
  })

  test('it returns the requested page and page size', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?page=3&pageSize=5',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual(
      expect.objectContaining({
        count: 3,
        totalCount: 13,
        page: 3,
        pageSize: 5,
        totalPages: 3,
        hasNextPage: false,
        hasPreviousPage: true
      })
    )
  })

  test('it matches a CPH given with slashes', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=22%2F001%2F0001',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values.map((holding) => holding.identifier)).toEqual(
      ['22/001/0001']
    )
  })

  test('it matches a CPH given as nine digits', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=220010001',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values.map((holding) => holding.identifier)).toEqual(
      ['22/001/0001']
    )
  })

  test('it matches a postcode given without its space', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=SY41AB',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values.map((holding) => holding.identifier)).toEqual(
      ['22/001/0001']
    )
  })

  test('it matches holding and party names case-insensitively by word prefix', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=OAKF',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values.map((holding) => holding.identifier)).toEqual(
      ['22/001/0001']
    )
  })

  test('it requires every word in the search to match', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=oakfield%20riverside',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values).toEqual([])
    expect(response.result.totalCount).toBe(0)
  })

  test('it does not match on herd marks, as keeper-data-api does not index them', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=324537',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.totalCount).toBe(0)
  })

  test('it returns an empty page when nothing matches', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=zzz',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({
      values: [],
      count: 0,
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
      nextCursor: null
    })
  })

  test('it orders by name descending with unnamed holdings last', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?order=NAME&sort=DESC&pageSize=100',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values[0].name).toBe('Unsuitable Holding')
    expect(response.result.values.at(-1).identifier).toBe('22/003/0003')
  })

  test('it orders by name ascending with unnamed holdings first', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?order=name&pageSize=100',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values[0].identifier).toBe('22/003/0003')
    expect(response.result.values[1].name).toBe('Cancelled Holding')
  })

  test('it returns association addresses and an integer udprn', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=22%2F001%2F0001',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values[0].location.address.udprn).toBe(12345678)
    expect(response.result.values[0].associations[0].address).toEqual({
      addressLine1: 'Oakfield Farm',
      addressLine2: 'Church Lane',
      addressTown: 'Shrewsbury',
      addressLocality: 'Shropshire',
      addressNation: 'England',
      addressPostcode: 'SY4 1AB',
      addressCountryCode: 'GB'
    })
  })

  test('it returns 400 for a page size over 100', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?pageSize=101',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.errors).toEqual({
      pageSize: ['PageSize must be between 1 and 100.']
    })
  })

  test('it returns 400 for a page below 1', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?page=0',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.errors).toEqual({
      page: ['Page must be greater than or equal to 1.']
    })
  })

  test('it returns 400 for a page that is not a number', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?page=abc',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.errors).toEqual({
      page: ["The value 'abc' is not valid for page."]
    })
  })

  test('it returns 400 for an unknown sort direction', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?sort=up',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.errors).toEqual({
      sort: ["Sort must be 'asc' or 'desc'."]
    })
  })

  test('it returns 400 for an unknown order field', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?order=colour',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.errors).toEqual({
      order: [
        'Order must be cph, identifier, name, holdingType, startDate, or endDate.'
      ]
    })
  })

  test('it returns 400 for a search with unsupported characters', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=%3Cscript%3E',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.errors).toEqual({
      search: [
        'Search contains an unsupported expression. Use words, spaces, email or phone punctuation, commas, ampersands, apostrophes, hyphens or CPH slashes.'
      ]
    })
  })

  test('it returns 400 for a search with no letters or digits', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=---',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.errors).toEqual({
      search: ['Search must contain at least one letter or digit.']
    })
  })

  test('it returns 400 for a search over 200 characters', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/krds/api/v2/holdings?search=${'a'.repeat(201)}`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.errors).toEqual({
      search: ['Search must be at most 200 characters.']
    })
  })

  test('it returns 401 for a search without an Authorization header', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings'
    })

    // Assert
    expect(response.statusCode).toBe(401)
  })
})
