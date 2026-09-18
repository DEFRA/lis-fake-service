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

async function postUserAccount(server, payload) {
  return server.inject({
    method: 'POST',
    url: '/krds/api/v2/user-accounts',
    headers: { authorization: VALID_AUTH_HEADER },
    payload
  })
}

// Pre-existing, subject-bound account from data/fixtures/users.json.
const SEEDED_SUBJECT = 'cd91b1e0-bae4-4cee-becf-3529cc557311'
const SEEDED_EMAIL = 'oakfield.farmer@oakhill-farms.co.uk'

describe('user-accounts', () => {
  beforeAll(() => {
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  test('it returns 401 for POST when the Authorization header is missing', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'POST',
      url: '/krds/api/v2/user-accounts',
      payload: { email: 'new.keeper@example.com' }
    })

    // Assert
    expect(response.statusCode).toBe(401)
  })

  test('it creates a new account and returns 201 when nothing matches', async () => {
    // Arrange
    const server = await makeServer()
    const payload = {
      sub: 'a1a1a1a1-1111-4111-8111-111111111111',
      email: 'new.keeper@example.com',
      given_name: 'New',
      family_name: 'Keeper'
    }

    // Act
    const response = await postUserAccount(server, payload)

    // Assert
    expect(response.statusCode).toBe(201)
    expect(response.result.subject).toBe(payload.sub)
    expect(response.result.email).toBe(payload.email)
    expect(response.result.firstName).toBe('New')
    expect(response.result.lastName).toBe('Keeper')
    expect(response.result.displayName).toBe('New Keeper')
    expect(response.result.cphAssociations).toEqual([])
  })

  test('it refreshes and returns 200 for an account matched by subject', async () => {
    // Arrange
    const server = await makeServer()
    const payload = {
      sub: SEEDED_SUBJECT,
      email: SEEDED_EMAIL,
      given_name: 'Oakfield',
      family_name: 'Farmer'
    }

    // Act
    const response = await postUserAccount(server, payload)

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.subject).toBe(SEEDED_SUBJECT)
    expect(response.result.cphAssociations).toEqual([
      expect.objectContaining({ cphNumber: '22/001/0001', role: 'Keeper' })
    ])
  })

  test('it adopts an account matched by email with no subject bound yet', async () => {
    // Arrange
    const server = await makeServer()
    const email = 'adoptee@example.com'
    await postUserAccount(server, {
      email,
      given_name: 'Ada',
      family_name: 'Optee'
    })
    const sub = 'b2b2b2b2-2222-4222-8222-222222222222'

    // Act
    const response = await postUserAccount(server, {
      sub,
      email,
      given_name: 'Ada',
      family_name: 'Optee'
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.subject).toBe(sub)
    expect(response.result.email).toBe(email)
  })

  test('it returns 409 when the email is already bound to a different subject', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await postUserAccount(server, {
      sub: 'c3c3c3c3-3333-4333-8333-333333333333',
      email: SEEDED_EMAIL
    })

    // Assert
    expect(response.statusCode).toBe(409)
    expect(response.result.title).toBe('Conflict')
  })

  test('it returns 422 when email is missing', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await postUserAccount(server, { sub: 'no-email-sub' })

    // Assert
    expect(response.statusCode).toBe(422)
    expect(response.result.title).toBe('Unprocessable Entity')
    expect(response.result.errors.email).toEqual([
      'email must not be null or blank.'
    ])
  })

  test('it returns the account for a known subject', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `/krds/api/v2/user-accounts/${SEEDED_SUBJECT}`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.subject).toBe(SEEDED_SUBJECT)
    expect(response.result.email).toBe(SEEDED_EMAIL)
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
