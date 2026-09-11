import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import hapi from '@hapi/hapi'
import { config } from '../../config/config.js'
import { cads } from './index.js'

const configValues = {
  'cads.apiKey': 'test-cads-key'
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
const KNOWN_CPH = '22/001/0001'
const KNOWN_CPH_COUNT = 35
const KNOWN_EMPTY_CPH = '22/099/0099'

describe('cads', () => {
  beforeAll(() => {
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  test('it returns 401 when the x-api-key header is missing', async () => {
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

  test('it returns 401 when the x-api-key header is invalid', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals/${KNOWN_IDENTIFIER}`,
      headers: { 'x-api-key': 'wrong-key' }
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
      headers: { 'x-api-key': 'test-cads-key' }
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

  test('it returns the richer CADS detail for a dead animal', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals/${DEAD_IDENTIFIER}`,
      headers: { 'x-api-key': 'test-cads-key' }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.animalDetail.state).toBe('Dead')
    expect(response.result.animalDetail.dateOfDeath).toBe('2026-01-01')
  })

  test('it returns 404 with a problem body for an unknown identifier', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/cads/api/v1/bovine/animals/UK000000000000',
      headers: { 'x-api-key': 'test-cads-key' }
    })

    // Assert
    expect(response.statusCode).toBe(404)
    expect(response.result.title).toBe('Not Found')
    expect(response.result.status).toBe(404)
  })

  test('it returns the first page of animals for a known CPH when no paging params are given', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}`,
      headers: { 'x-api-key': 'test-cads-key' }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result).toMatchObject({
      count: 10,
      totalCount: KNOWN_CPH_COUNT,
      page: 1,
      pageSize: 10,
      totalPages: 4,
      hasNextPage: true,
      hasPreviousPage: false
    })
    expect(response.result.results).toHaveLength(10)

    // The endpoint orders by ear tag ascending regardless of fixture order.
    const earTags = response.result.results.map((a) => a.identifier.identifier)
    expect(earTags).toEqual([...earTags].sort())
    expect(earTags[0]).toBe(KNOWN_IDENTIFIER)
  })

  test('it ignores order and sort params, always returning ear tag ascending', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&order=sex&sort=desc`,
      headers: { 'x-api-key': 'test-cads-key' }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    const earTags = response.result.results.map((a) => a.identifier.identifier)
    expect(earTags).toEqual([...earTags].sort())
  })

  test('it accepts unknown query params without failing', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&holdingAssociation=RegisteredOnHolding&q=UK2000&direction=desc`,
      headers: { 'x-api-key': 'test-cads-key' }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.totalCount).toBe(KNOWN_CPH_COUNT)
  })

  test('it applies page and pageSize to the animals on a known CPH', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&page=2&pageSize=3`,
      headers: { 'x-api-key': 'test-cads-key' }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result).toMatchObject({
      count: 3,
      totalCount: KNOWN_CPH_COUNT,
      page: 2,
      pageSize: 3,
      totalPages: 12,
      hasNextPage: true,
      hasPreviousPage: true
    })
    expect(response.result.results.map((a) => a.identifier.identifier)).toEqual(
      ['UK200000000004', 'UK200000000005', 'UK200000000006']
    )
  })

  test('it returns an empty page for a page past the end', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&page=99&pageSize=3`,
      headers: { 'x-api-key': 'test-cads-key' }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.results).toEqual([])
    expect(response.result).toMatchObject({
      count: 0,
      totalCount: KNOWN_CPH_COUNT,
      page: 99,
      pageSize: 3,
      hasNextPage: false,
      hasPreviousPage: true
    })
  })

  test('it returns 400 when a paging param is not a positive integer', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&page=0`,
      headers: { 'x-api-key': 'test-cads-key' }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.title).toBe('Bad Request')
  })

  test('it returns an empty results page for a recognised CPH with no animals', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_EMPTY_CPH}`,
      headers: { 'x-api-key': 'test-cads-key' }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result).toMatchObject({
      results: [],
      count: 0,
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    })
  })

  test('it returns 404 with a problem body for an unknown CPH', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/cads/api/v1/bovine/animals?CPH=99/999/9999',
      headers: { 'x-api-key': 'test-cads-key' }
    })

    // Assert
    expect(response.statusCode).toBe(404)
    expect(response.result.title).toBe('Not Found')
  })

  test('it returns 400 when the CPH query parameter is missing', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/cads/api/v1/bovine/animals',
      headers: { 'x-api-key': 'test-cads-key' }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.title).toBe('Bad Request')
    expect(response.result.status).toBe(400)
  })
})
