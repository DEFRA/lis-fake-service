import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'
import hapi from '@hapi/hapi'
import { config } from '../../config/config.js'
import { allAnimals } from '../common/data/animals.js'
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

const KNOWN_CPH = '22/001/0001'
const NULL_FIELDS_IDENTIFIER = 'UK999999999999'

const LIST_URL = '/cads/api/v1/bovine/animals'

const earTagsOf = (response) =>
  response.result.animals.map((a) => a.identifier.identifier)

describe('cads animals on holding sorting', () => {
  beforeAll(() => {
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  afterEach(() => {
    const index = allAnimals.findIndex(
      (a) => a.earTag === NULL_FIELDS_IDENTIFIER
    )
    if (index !== -1) {
      allAnimals.splice(index, 1)
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  test('it sorts by BirthDate descending, ignoring case', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&orderBy=birthdate&direction=desc`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    // UK300000000004 (born 2026-06-01) is the most recent birth date.
    expect(earTagsOf(response)[0]).toBe('UK300000000004')
  })

  test('it sorts by DateOnCPH ascending', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&orderBy=DateOnCPH&pageSize=100`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    const dates = response.result.animals.map((a) => a.dateOnCPH)
    expect(dates).toEqual([...dates].sort())
  })

  test('it sorts by BreedCode ascending', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&orderBy=BreedCode&pageSize=100`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    const breeds = response.result.animals.map((a) => a.breedCode.identifier)
    expect(breeds).toEqual([...breeds].sort())
  })

  test('it sorts by Sex descending and ties break by ascending dateOnCPH', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&orderBy=Sex&direction=Desc&pageSize=100`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    const { animals } = response.result
    expect(animals[0].sex).toBe('Male')
    expect(animals.at(-1).sex).toBe('Female')
    const maleDates = animals
      .filter((a) => a.sex === 'Male')
      .map((a) => a.dateOnCPH)
    expect(maleDates).toEqual([...maleDates].sort())
  })

  test('it sorts by Identifier descending', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&orderBy=Identifier&direction=Desc&pageSize=100`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    const earTags = earTagsOf(response)
    expect(earTags).toEqual([...earTags].sort().reverse())
  })

  test('it sorts null birth dates last when ascending', async () => {
    // Arrange
    const server = await makeServer()
    allAnimals.push({
      earTag: NULL_FIELDS_IDENTIFIER,
      sex: 'Female',
      breedCode: 'AA',
      birthDate: null,
      currentCph: KNOWN_CPH,
      dateOnCph: null,
      dateOffCph: null,
      dateOfDeath: null
    })

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&orderBy=BirthDate&direction=Asc&pageSize=100`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(earTagsOf(response).at(-1)).toBe(NULL_FIELDS_IDENTIFIER)
  })

  test('it sorts null birth dates last when descending', async () => {
    // Arrange
    const server = await makeServer()
    allAnimals.push({
      earTag: NULL_FIELDS_IDENTIFIER,
      sex: 'Female',
      breedCode: 'AA',
      birthDate: null,
      currentCph: KNOWN_CPH,
      dateOnCph: null,
      dateOffCph: null,
      dateOfDeath: null
    })

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&orderBy=BirthDate&direction=Desc&pageSize=100`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(earTagsOf(response).at(-1)).toBe(NULL_FIELDS_IDENTIFIER)
  })

  test('it breaks ties with null dateOnCPH last, even when descending', async () => {
    // Arrange
    const server = await makeServer()
    allAnimals.push({
      earTag: NULL_FIELDS_IDENTIFIER,
      sex: 'Male',
      breedCode: 'AA',
      birthDate: '2020-01-01',
      currentCph: KNOWN_CPH,
      dateOnCph: null,
      dateOffCph: null,
      dateOfDeath: null
    })

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&orderBy=Sex&direction=Desc&pageSize=100`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    const males = response.result.animals.filter((a) => a.sex === 'Male')
    expect(males.at(-1).identifier.identifier).toBe(NULL_FIELDS_IDENTIFIER)
  })
})
