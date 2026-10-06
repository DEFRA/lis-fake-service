import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import hapi from '@hapi/hapi'
import { config } from '../../config/config.js'
import { cads } from './index.js'

const CLIENT_ID = 'test-client'
const CLIENT_SECRET = 'test-secret'
const encodedCredentials = Buffer.from(
  `${CLIENT_ID}:${CLIENT_SECRET}`
).toString('base64')
const VALID_AUTH_HEADER = `Basic ${encodedCredentials}`

const configValues = {
  'cads.clientId': CLIENT_ID,
  'cads.clientSecret': CLIENT_SECRET
}

const mocks = {
  configGet: vi.spyOn(config, 'get')
}

async function makeServer() {
  const server = hapi.server()
  await server.register(cads)
  return server
}

const KNOWN_IDENTIFIER = 'UK200000000001'
const DEAD_IDENTIFIER = 'UK300000000001'

describe('cads', () => {
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
      url: `/cads/api/v1/bovine/animals/${KNOWN_IDENTIFIER}`
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
      url: `/cads/api/v1/bovine/animals/${KNOWN_IDENTIFIER}`,
      headers: { authorization: wrongHeader }
    })

    // Assert
    expect(response.statusCode).toBe(401)
    expect(response.result.title).toBe('Unauthorized')
  })

  test('it returns the animal details for a known identifier', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals/${KNOWN_IDENTIFIER}`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.resourceType).toBe('AnimalDetail')
    expect(response.result.identifier).toBe(KNOWN_IDENTIFIER)
    expect(response.result.source).toEqual({
      system: 'CTS',
      schema: 'animal_details',
      schemaVersion: '1.0'
    })
    expect(response.result.eventDateTime).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    )
    expect(response.result.animalDetail.identifier.identifier).toBe(
      KNOWN_IDENTIFIER
    )
    expect(response.result.animalDetail.parentage).toHaveLength(2)
  })

  test("it marks a dead animal's state, without a dateOfDeath field the real DTO does not have", async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals/${DEAD_IDENTIFIER}`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.animalDetail.state).toBe('Dead')
    expect(response.result.animalDetail.dateOfDeath).toBeUndefined()
  })

  test('it returns 404 with a problem body for an unknown identifier', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/cads/api/v1/bovine/animals/UK000000000000',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(404)
    expect(response.result.title).toBe('Not Found')
    expect(response.result.status).toBe(404)
  })
})
