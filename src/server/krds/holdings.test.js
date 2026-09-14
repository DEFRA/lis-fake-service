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
    expect(response.result.associations).toHaveLength(1)
    expect(response.result.allowedSpecies).toEqual(['Cattle'])
    expect(response.result.marks).toHaveLength(1)
  })

  test('it returns a holding with multiple associations and marks', async () => {
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
    expect(response.result.associations).toHaveLength(2)
    expect(response.result.marks).toHaveLength(2)
    expect(response.result.allowedSpecies).toEqual(['Cattle', 'Sheep'])
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
})
