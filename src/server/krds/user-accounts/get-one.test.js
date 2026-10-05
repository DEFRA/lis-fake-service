import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import hapi from '@hapi/hapi'
import { config } from '../../../config/config.js'
import { krds } from '../index.js'
import { userAccountStore } from '../data/user-accounts.js'

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

async function postUserAccount(server, payload) {
  return server.inject({
    method: 'POST',
    url: '/krds/api/v2/user-accounts',
    headers: { authorization: VALID_AUTH_HEADER },
    payload
  })
}

describe('GET /krds/api/v2/user-accounts/{subject}', () => {
  beforeAll(() => {
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.configGet.mockImplementation((key) => configValues[key])
    // The store is a module singleton - start every test with no accounts.
    userAccountStore.accountsById.clear()
  })

  test('it returns the account for a known subject', async () => {
    // Arrange
    const server = await makeServer()
    const sub = 'f6f6f6f6-6666-4666-8666-666666666666'
    const email = 'known.subject@example.com'
    await postUserAccount(server, {
      sub,
      email,
      given_name: 'Known',
      family_name: 'Subject'
    })

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/krds/api/v2/user-accounts/${sub}`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.subject).toBe(sub)
    expect(response.result.email).toBe(email)
  })

  test('it returns 404 for an unrecognised but well-formed subject', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/user-accounts/00000000-0000-4000-8000-000000000000',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(404)
    expect(response.result.title).toBe('Not Found')
  })

  test('it returns 422 for a malformed subject', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: '/krds/api/v2/user-accounts/not-a-uuid',
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(422)
    expect(response.result.title).toBe('Unprocessable Entity')
  })
})
