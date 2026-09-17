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
const OFF_FARM_IDENTIFIER = 'UK300000000025'
const CROSS_BREED_IDENTIFIER = 'UK300000000024'
const KNOWN_CPH = '22/001/0001'
const KNOWN_CPH_COUNT = 37
const KNOWN_EMPTY_CPH = '22/099/0099'

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

  test('it returns page 1 at the default page size when no paging params are given', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result).toMatchObject({
      resourceType: 'AnimalCollection',
      page: 1,
      pageSize: 25,
      totalPages: 2,
      totalRecords: KNOWN_CPH_COUNT
    })
    expect(response.result.animals).toHaveLength(25)

    // Sorted by ear tag ascending by default.
    const earTags = response.result.animals.map((a) => a.identifier.identifier)
    expect(earTags).toEqual([...earTags].sort())
    expect(earTags[0]).toBe(KNOWN_IDENTIFIER)
  })

  test('it applies page and page-size to the animals on a known CPH', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&page=2&page-size=3`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result).toMatchObject({
      page: 2,
      pageSize: 3,
      totalPages: 13,
      totalRecords: KNOWN_CPH_COUNT
    })
    expect(response.result.animals.map((a) => a.identifier.identifier)).toEqual(
      ['UK200000000004', 'UK200000000005', 'UK200000000006']
    )
  })

  test('it returns an empty page for a page past the end, still reporting the totals', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&page=99&page-size=3`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.animals).toEqual([])
    expect(response.result).toMatchObject({
      page: 99,
      pageSize: 3,
      totalPages: 13,
      totalRecords: KNOWN_CPH_COUNT
    })
  })

  test('it returns 400 when a paging param is not a positive integer', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&page=0`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.title).toBe('Bad Request')
  })

  test('it sorts by the requested column and direction, ignoring case', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&order-by=BirthDate&direction=Desc`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    // UK300000000004 (born 2026-06-01) is the most recent birth date.
    expect(response.result.animals[0].identifier.identifier).toBe(
      'UK300000000004'
    )
  })

  test('it uses the registered-on-CPH date when holdingAssociation is RegisteredOnHolding', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&holdingAssociation=RegisteredOnHolding`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.totalRecords).toBe(KNOWN_CPH_COUNT)
    const known = response.result.animals.find(
      (a) => a.identifier.identifier === KNOWN_IDENTIFIER
    )
    expect(known.dateOnCPH).toBe('2023-02-05')
  })

  test('it filters by status', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const [dead, offFarm] = await Promise.all([
      server.inject({
        method: 'GET',
        url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&status=Dead`,
        headers: { authorization: VALID_AUTH_HEADER }
      }),
      server.inject({
        method: 'GET',
        url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&status=OffFarm`,
        headers: { authorization: VALID_AUTH_HEADER }
      })
    ])

    // Assert
    expect(dead.result.animals.map((a) => a.identifier.identifier)).toEqual([
      DEAD_IDENTIFIER
    ])
    expect(offFarm.result.animals.map((a) => a.identifier.identifier)).toEqual([
      OFF_FARM_IDENTIFIER
    ])
  })

  test('it filters by a single sex value', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&sex=Male&page-size=100`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.animals.every((a) => a.sex === 'Male')).toBe(true)
    expect(
      response.result.animals.some(
        (a) => a.identifier.identifier === OFF_FARM_IDENTIFIER
      )
    ).toBe(false)
  })

  test('it filters by breed code, matching exactly rather than as a substring', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&breedCode=HFX`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.result.animals.map((a) => a.identifier.identifier)).toEqual(
      [CROSS_BREED_IDENTIFIER]
    )
  })

  test('it filters by dateOnCPHFrom', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&dateOnCPHFrom=2025-04-01&page-size=100`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    const earTags = response.result.animals.map((a) => a.identifier.identifier)
    expect(earTags).toContain(CROSS_BREED_IDENTIFIER)
    expect(earTags).not.toContain(KNOWN_IDENTIFIER)
  })

  test('it searches breed name for a partial, case-insensitive match', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&q=friesian cross`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.result.animals.map((a) => a.identifier.identifier)).toEqual(
      [CROSS_BREED_IDENTIFIER]
    )
  })

  test('it searches sex by whole value only, so "male" excludes Female animals', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&q=male&page-size=100`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.result.animals.length).toBeGreaterThan(0)
    expect(response.result.animals.every((a) => a.sex === 'Male')).toBe(true)
  })

  test('it searches the ear tag for a partial match', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_CPH}&q=${CROSS_BREED_IDENTIFIER}`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.result.animals.map((a) => a.identifier.identifier)).toEqual(
      [CROSS_BREED_IDENTIFIER]
    )
  })

  test('it returns an empty collection, not a 404, for a recognised CPH with no animals', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals?CPH=${KNOWN_EMPTY_CPH}`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result).toMatchObject({
      resourceType: 'AnimalCollection',
      animals: [],
      page: 1,
      pageSize: 25,
      totalPages: 1,
      totalRecords: 0
    })
  })

  test('it returns 404 with a problem body for an unknown CPH', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/cads/api/v1/bovine/animals?CPH=99/999/9999',
      headers: { authorization: VALID_AUTH_HEADER }
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
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.title).toBe('Bad Request')
    expect(response.result.status).toBe(400)
  })
})
