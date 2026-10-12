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
const SPARSE_IDENTIFIER = 'UK300000000026'
const SURROGATE_DAM_IDENTIFIER = 'UK200000000003'
const DAM_ONLY_IDENTIFIER = 'UK200000000007'
const NO_PARENTS_IDENTIFIER = 'UK200000000002'

describe('cads animal details', () => {
  beforeAll(() => {
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  test('it returns the genetic dam then the sire when both are recorded', async () => {
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
    expect(response.result.animalDetail.parentage).toEqual([
      {
        relationship: 'GeneticDam',
        animalIdentifier: {
          schema: 'uk.gov.defra.ear-tag.conventional',
          identifier: 'UK200000000098'
        }
      },
      {
        relationship: 'Sire',
        animalIdentifier: {
          schema: 'uk.gov.defra.ear-tag.conventional',
          identifier: 'UK200000000099'
        }
      }
    ])
  })

  test('it returns a surrogate dam alongside the genetic dam and sire when one is recorded', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals/${SURROGATE_DAM_IDENTIFIER}`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.animalDetail.parentage).toEqual([
      {
        relationship: 'GeneticDam',
        animalIdentifier: {
          schema: 'uk.gov.defra.ear-tag.conventional',
          identifier: 'UK200000000094'
        }
      },
      {
        relationship: 'SurrogateDam',
        animalIdentifier: {
          schema: 'uk.gov.defra.ear-tag.conventional',
          identifier: 'UK200000000095'
        }
      },
      {
        relationship: 'Sire',
        animalIdentifier: {
          schema: 'uk.gov.defra.ear-tag.conventional',
          identifier: 'UK200000000096'
        }
      }
    ])
  })

  test('it returns only the genetic dam when no sire is recorded', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals/${DAM_ONLY_IDENTIFIER}`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.animalDetail.parentage).toEqual([
      {
        relationship: 'GeneticDam',
        animalIdentifier: {
          schema: 'uk.gov.defra.ear-tag.conventional',
          identifier: 'UK200000000097'
        }
      }
    ])
  })

  test('it returns an empty parentage list when no parents are recorded', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals/${NO_PARENTS_IDENTIFIER}`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.animalDetail.parentage).toEqual([])
  })

  test('it names the date-on-holding field dateOnCPH and reports an unrestricted animal as Unrestricted', async () => {
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
    expect(response.result.animalDetail.dateOnCPH).toBe('2023-02-01')
    expect(response.result.animalDetail.dateOnCph).toBeUndefined()
    expect(response.result.animalDetail.restrictionStatus).toBe('Unrestricted')
  })

  test('it returns nulls and an Unknown sex for an animal with a sparse record', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals/${SPARSE_IDENTIFIER}`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.animalDetail.sex).toBe('Unknown')
    expect(response.result.animalDetail.registrationDate).toBeNull()
    expect(response.result.animalDetail.dateOnCPH).toBeNull()
    expect(response.result.animalDetail.breedCode).toBeNull()
  })

  test('it ignores whitespace around the identifier', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/cads/api/v1/bovine/animals/%20${KNOWN_IDENTIFIER}%20`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.identifier).toBe(KNOWN_IDENTIFIER)
  })

  test('it returns 400 when the identifier is longer than 20 characters', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/cads/api/v1/bovine/animals/UK2000000000010000000',
      headers: {
        authorization: VALID_AUTH_HEADER,
        'x-correlation-id': 'test-correlation-id'
      }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result).toEqual({
      title: 'Validation errors',
      status: 400,
      detail:
        "One or more validation errors occurred. See the 'errors' field for details.",
      instance: '/api/v1/bovine/animals/UK2000000000010000000',
      errors: {
        '': [
          "The length of '' must be 20 characters or fewer. You entered 21 characters."
        ]
      },
      traceId: 'test-correlation-id',
      correlationId: 'test-correlation-id',
      errorId: expect.stringMatching(/^[0-9a-f-]{36}$/)
    })
  })

  test('it accepts an identifier of exactly 20 characters, ignoring surrounding whitespace', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/cads/api/v1/bovine/animals/%20UK200000000001000000%20',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(404)
  })

  test('it reports every failed rule when the identifier is too long and has invalid characters', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/cads/api/v1/bovine/animals/UK20000-00000010000000',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.errors).toEqual({
      '': [
        "The length of '' must be 20 characters or fewer. You entered 22 characters.",
        "'' is not in the correct format."
      ]
    })
  })

  test('it returns 400 when the identifier contains characters other than letters, digits and spaces', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/cads/api/v1/bovine/animals/UK20000-0000001',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.title).toBe('Validation errors')
    expect(response.result.errors).toEqual({
      '': ["'' is not in the correct format."]
    })
    expect(response.result.correlationId).toMatch(/^[0-9a-f-]{36}$/)
    expect(response.result.traceId).toBe(response.result.correlationId)
  })

  test('it returns the ASP.NET model binding 400 when the identifier is only whitespace', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/cads/api/v1/bovine/animals/%20',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result).toEqual({
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: { identifier: ['The identifier field is required.'] },
      traceId: expect.stringMatching(/^00-[0-9a-f]{32}-[0-9a-f]{16}-00$/)
    })
  })
})
