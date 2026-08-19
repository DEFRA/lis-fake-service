import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import hapi from '@hapi/hapi'
import { config } from '../../config/config.js'
import { identityServiceHelper } from './index.js'

const configValues = {
  'identityServiceHelper.apiKey': 'test-api-key'
}

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
      url: '/identity-service-helper/users/00000000-0000-0000-0000-000000000002/profile',
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
      url: '/identity-service-helper/users/00000000-0000-0000-0000-000000000002/profile',
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
      url: '/identity-service-helper/users/00000000-0000-0000-0000-000000000002/profile',
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
      url: '/identity-service-helper/users/00000000-0000-0000-0000-000000000002/profile',
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
      url: '/identity-service-helper/users/00000000-0000-0000-0000-000000000002/profile',
      headers: {
        'x-api-key': 'test-api-key',
        'x-correlation-id': 'correlation-1'
      }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.userDetails.id).toBe(
      '00000000-0000-0000-0000-000000000002'
    )
  })
})
