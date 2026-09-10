import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import hapi from '@hapi/hapi'
import { config } from '../../config/config.js'
import { holdingId } from '../common/data/locations.js'
import { userId } from '../common/data/users.js'
import { identityServiceHelper } from './index.js'

const configValues = {
  'identityServiceHelper.apiKey': 'test-api-key'
}

const TEST_FARMER_ID = userId('farmer@example.com')
const OAKFIELD_EMAIL = 'oakfield.farmer@oakhill-farms.co.uk'
const OAKFIELD_ID = userId(OAKFIELD_EMAIL)

const mocks = {
  configGet: vi.spyOn(config, 'get')
}

async function makeServer() {
  const server = hapi.server()
  await server.register(identityServiceHelper)
  return server
}

describe('identityServiceHelper', () => {
  beforeAll(() => {
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  test('it returns 400 when the x-api-key header is missing', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/identity-service-helper/users/${TEST_FARMER_ID}/profile`,
      headers: { 'x-correlation-id': 'correlation-1' }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.error.code).toBe('missing_header')
    expect(response.result.error.details.header).toBe('x-api-key')
  })

  test('it returns 400 when the x-api-key header is invalid', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/identity-service-helper/users/${TEST_FARMER_ID}/profile`,
      headers: {
        'x-api-key': 'wrong-key',
        'x-correlation-id': 'correlation-1'
      }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.error.code).toBe('invalid_api_key')
  })

  test('it returns 400 when the x-correlation-id header is missing', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/identity-service-helper/users/${TEST_FARMER_ID}/profile`,
      headers: { 'x-api-key': 'test-api-key' }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.error.code).toBe('missing_header')
    expect(response.result.error.details.header).toBe('x-correlation-id')
  })

  test('it returns 400 when the x-correlation-id header is blank after trimming quotes/whitespace', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/identity-service-helper/users/${TEST_FARMER_ID}/profile`,
      headers: { 'x-api-key': 'test-api-key', 'x-correlation-id': ' "" ' }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.error.details.header).toBe('x-correlation-id')
  })

  test('it returns 404 for an unknown user id', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/identity-service-helper/users/not-a-real-id/profile',
      headers: {
        'x-api-key': 'test-api-key',
        'x-correlation-id': 'correlation-1'
      }
    })

    // Assert
    expect(response.statusCode).toBe(404)
  })

  test('it returns the fixture profile for a known user id', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/identity-service-helper/users/${TEST_FARMER_ID}/profile`,
      headers: {
        'x-api-key': 'test-api-key',
        'x-correlation-id': 'correlation-1'
      }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.userDetails.id).toBe(TEST_FARMER_ID)
  })

  test('it resolves each direct assignment holding from the shared locations registry', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/identity-service-helper/users/${OAKFIELD_ID}/profile`,
      headers: {
        'x-api-key': 'test-api-key',
        'x-correlation-id': 'correlation-1'
      }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.userDetails).toEqual({
      id: OAKFIELD_ID,
      email: OAKFIELD_EMAIL,
      firstName: 'Oakfield',
      displayName: 'Oakfield Farmer',
      active: true
    })
    expect(response.result.directAssignments).toEqual([
      expect.objectContaining({
        countyParishHoldingNumber: '22/001/0001',
        countyParishHoldingId: holdingId('22/001/0001'),
        roleName: 'Keeper',
        userId: OAKFIELD_ID
      })
    ])
    expect(response.result.directAssignments[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })
})
