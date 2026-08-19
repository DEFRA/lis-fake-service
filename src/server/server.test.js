import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { config } from '../config/config.js'
import { createServer } from './server.js'

const configValues = {
  'identityServiceHelper.apiKey': 'test-api-key'
}

const mocks = {
  configGet: vi.spyOn(config, 'get')
}

describe('createServer()', () => {
  beforeAll(() => {
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  test('it responds to the health check', async () => {
    // Arrange
    const server = await createServer()

    // Act
    const response = await server.inject({ method: 'GET', url: '/health' })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({ message: 'success' })
  })

  test('it registers the identity-service-helper routes', async () => {
    // Arrange
    const server = await createServer()

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

  test('it registers the cts-ws route', async () => {
    // Arrange
    const server = await createServer()

    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/cts_ws/DefraDataTransferPublicNWSE.asmx',
      payload: 'not-a-valid-envelope'
    })

    // Assert
    expect(response.statusCode).not.toBe(404)
  })

  test('it returns a JSON error response for an unmatched route', async () => {
    // Arrange
    const server = await createServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/not-a-real-route'
    })

    // Assert
    expect(response.statusCode).toBe(404)
    expect(response.result).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          statusCode: 404,
          message: 'Page not found'
        })
      })
    )
  })
})
