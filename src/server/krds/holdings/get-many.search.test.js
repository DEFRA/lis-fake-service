import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import hapi from '@hapi/hapi'
import { config } from '../../../config/config.js'
import { krds } from '../index.js'

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

describe('GET /krds/api/v2/holdings search matching', () => {
  beforeAll(() => {
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.configGet.mockImplementation((key) => configValues[key])
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

  test('it matches holding names case-insensitively by word prefix', async () => {
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

  test('it matches a CPH given with spaces', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=22%20001%200001',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values.map((holding) => holding.identifier)).toEqual(
      ['22/001/0001']
    )
  })
  test('it matches a partial CPH of parish and holding with a slash', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=001%2F0001',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values.map((holding) => holding.identifier)).toEqual(
      ['22/001/0001']
    )
  })
  test('it matches a partial CPH of parish and holding with a space', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=001%200001',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values.map((holding) => holding.identifier)).toEqual(
      ['22/001/0001']
    )
  })
  test('it matches a holding number on its own', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=0001',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values.map((holding) => holding.identifier)).toEqual(
      ['22/001/0001']
    )
  })
  test('it matches a herd mark with the UK prefix and a space', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=UK%20324537',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values.map((holding) => holding.identifier)).toEqual(
      ['22/001/0001']
    )
  })
  test('it matches a herd mark with the UK prefix and no space', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=UK324537',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values.map((holding) => holding.identifier)).toEqual(
      ['22/001/0001']
    )
  })
  test('it matches a herd mark with a lower-case UK prefix', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=uk324537',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values.map((holding) => holding.identifier)).toEqual(
      ['22/001/0001']
    )
  })
  test('it matches a herd mark without the UK prefix', async () => {
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
    expect(response.result.values.map((holding) => holding.identifier)).toEqual(
      ['22/001/0001']
    )
  })
  test('it matches a postcode given with its space', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=MK1%201AA',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values.map((holding) => holding.identifier)).toEqual(
      ['22/002/0002']
    )
  })
  test('it matches an inward postcode on its own', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=1AA',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values.map((holding) => holding.identifier)).toEqual(
      ['03/202/0021', '22/002/0002']
    )
  })
  test('it matches a multi-word search only as a phrase in that order', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=Farm%20Oakfield',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values).toEqual([])
    expect(response.result.totalCount).toBe(0)
  })
  test('it matches a multi-word search by the prefix of its final word', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=Long%20Ac',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values.map((holding) => holding.identifier)).toEqual(
      ['22/006/0006']
    )
  })
  test('it does not let a hyphen bridge two words, as the literal text must appear', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=Long-Acre',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values).toEqual([])
    expect(response.result.totalCount).toBe(0)
  })
  test('it matches the town', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=shrews',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values.map((holding) => holding.identifier)).toEqual(
      ['22/001/0001']
    )
  })
  test("it does not match a party's name, as keeper-data-api no longer indexes parties", async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=Farmer',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values).toEqual([])
    expect(response.result.totalCount).toBe(0)
  })
  test("it does not match a party's email address", async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=defralivestock',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values).toEqual([])
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

  test('it does not fold diacritics, as keeper-data-api checks the literal text', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/holdings?search=%C3%93AKFI%C3%89LD',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.values).toEqual([])
    expect(response.result.totalCount).toBe(0)
  })
})
