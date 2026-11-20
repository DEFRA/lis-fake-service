import { beforeEach, describe, expect, test, vi } from 'vitest'
import hapi from '@hapi/hapi'
import { config } from '../../../config/config.js'
import { luis } from '../index.js'
import { verifyToken } from '../token.js'

const configValues = {
  'luis.userId': 'test-user',
  'luis.password': 'test-password',
  'luis.tokenSecret': 'test-secret'
}

const mocks = {
  configGet: vi.spyOn(config, 'get')
}

async function makeServer() {
  const server = hapi.server()
  await server.register(luis)
  return server
}

function requestToken(server, payload) {
  return server.inject({
    method: 'POST',
    url: '/luis/Api/1.0/RequestToken',
    payload
  })
}

describe('POST /luis/Api/{v}/RequestToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  test('it returns the bare JWT as text for valid credentials', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await requestToken(server, {
      UserId: 'test-user',
      Password: 'test-password',
      CallerId: 'caller'
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/plain')
    expect(verifyToken(response.payload).CallerId).toBe('caller')
  })

  test('it returns 401 with an empty body for the wrong password', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await requestToken(server, {
      UserId: 'test-user',
      Password: 'wrong',
      CallerId: 'caller'
    })

    // Assert
    expect(response.statusCode).toBe(401)
    expect(response.payload).toBe('')
  })

  test('it returns 401 for the wrong user id', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await requestToken(server, {
      UserId: 'wrong',
      Password: 'test-password',
      CallerId: 'caller'
    })

    // Assert
    expect(response.statusCode).toBe(401)
  })

  test('it returns 401 when the caller id is empty', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await requestToken(server, {
      UserId: 'test-user',
      Password: 'test-password',
      CallerId: ''
    })

    // Assert
    expect(response.statusCode).toBe(401)
  })

  test('it returns 401 when fields are missing', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await requestToken(server, {
      UserId: 'test-user'
    })

    // Assert
    expect(response.statusCode).toBe(401)
  })

  test('it returns 401 when there is no body', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await requestToken(server, undefined)

    // Assert
    expect(response.statusCode).toBe(401)
  })
})
