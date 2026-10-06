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

const KNOWN_IDENTIFIER = 'UK200000000001'
const PASSPORT_PROBLEM_IDENTIFIER = 'UK200000000002'
const DEAD_IDENTIFIER = 'UK300000000001'
const OFF_FARM_IDENTIFIER = 'UK300000000025'
const KNOWN_CPH = '22/001/0001'
const KNOWN_CPH_LOCATION_NAME = 'Oakfield Farm'
const KNOWN_CPH_CURRENT_COUNT = 35
const KNOWN_EMPTY_CPH = '22/099/0099'
const NULL_FIELDS_IDENTIFIER = 'UK999999999999'

const LIST_URL = '/cads/api/v1/bovine/animals'
const MAX_PAGE_SIZE = 100

const earTagsOf = (response) =>
  response.result.animals.map((a) => a.identifier.identifier)

describe('cads animals on holding', () => {
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

  test('it returns 401 for the list without an Authorization header', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}`
    })

    // Assert
    expect(response.statusCode).toBe(401)
    expect(response.result.title).toBe('Unauthorized')
  })

  test('it returns page 1 at the default page size, sorted by ear tag ascending', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result).toMatchObject({
      resourceType: 'AnimalCollection',
      page: 1,
      pageSize: 25,
      totalRecords: KNOWN_CPH_CURRENT_COUNT
    })
    expect(response.result.animals).toHaveLength(25)
    const earTags = earTagsOf(response)
    expect(earTags).toEqual([...earTags].sort())
    expect(earTags[0]).toBe(KNOWN_IDENTIFIER)
  })

  test('it returns the AnimalCollection shape with keys in order', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&pageSize=1`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(Object.keys(response.result)).toEqual([
      'resourceType',
      'CPH',
      'locationName',
      'animals',
      'totalRecords',
      'page',
      'pageSize'
    ])
    expect(response.result.CPH).toEqual({
      schema: 'uk.gov.defra.cph',
      identifier: KNOWN_CPH
    })
    expect(response.result.locationName).toBe(KNOWN_CPH_LOCATION_NAME)
    expect(response.result.animals[0]).toEqual({
      identifier: {
        schema: 'uk.gov.defra.ear-tag.conventional',
        identifier: KNOWN_IDENTIFIER
      },
      birthDate: '2023-02-01',
      dateOnCPH: '2023-02-01',
      dateOffCPH: null,
      species: 'Cattle',
      sex: 'Male',
      breedCode: {
        schema: 'cts.breed',
        breedName: expect.any(String),
        identifier: 'AA'
      },
      status: 'Passport Produced'
    })
  })

  test('it excludes dead and off-farm animals', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&pageSize=100`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.result.totalRecords).toBe(KNOWN_CPH_CURRENT_COUNT)
    expect(earTagsOf(response)).not.toContain(DEAD_IDENTIFIER)
    expect(earTagsOf(response)).not.toContain(OFF_FARM_IDENTIFIER)
  })

  test('it returns an empty 200 for an unknown CPH', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=99/999/9999`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({
      resourceType: 'AnimalCollection',
      CPH: { schema: 'uk.gov.defra.cph', identifier: '99/999/9999' },
      locationName: null,
      animals: [],
      totalRecords: 0,
      page: 1,
      pageSize: 25
    })
  })

  test('it returns an empty 200 for a known CPH with no animals', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_EMPTY_CPH}`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.animals).toEqual([])
    expect(response.result.locationName).toBeNull()
  })

  test('it returns 400 when the CPH query parameter is missing', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.title).toBe('Bad Request')
    expect(response.result.detail).toBe(
      'One or more validation errors occurred.'
    )
    expect(response.result.errors).toEqual({
      CPH: ['The CPH field is required.']
    })
  })

  test('it returns 400 when the CPH query parameter is empty', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.title).toBe('Bad Request')
    expect(response.result.detail).toBe(
      'One or more validation errors occurred.'
    )
    expect(response.result.errors).toEqual({
      CPH: ['The CPH field is required.']
    })
  })

  test('it filters by sex ignoring case', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&sex=mALE&pageSize=100`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.animals.length).toBeGreaterThan(0)
    expect(response.result.animals.every((a) => a.sex === 'Male')).toBe(true)
    expect(response.result.totalRecords).toBe(response.result.animals.length)
  })

  test('it returns 400 for an invalid sex', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&sex=Other`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.title).toBe('Bad Request')
    expect(response.result.detail).toBe(
      'One or more validation errors occurred.'
    )
    expect(response.result.errors).toEqual({
      sex: ["The value 'Other' is not valid for sex."]
    })
  })

  test('it trims and upper-cases breedCode and matches it exactly', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&breedCode=%20hfx%20&pageSize=100`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.animals.length).toBeGreaterThan(0)
    expect(
      response.result.animals.every((a) => a.breedCode.identifier === 'HFX')
    ).toBe(true)
  })

  test('it uses the first value of repeated params', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&CPH=99/999/9999&sex=Male&sex=Female&breedCode=HFX&breedCode=AA&pageSize=1&pageSize=50&orderBy=Sex&orderBy=Nope&direction=Desc&direction=Nope&page=1&page=x`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.CPH.identifier).toBe(KNOWN_CPH)
    expect(response.result.pageSize).toBe(1)
    expect(response.result.animals[0].sex).toBe('Male')
    expect(response.result.animals[0].breedCode.identifier).toBe('HFX')
  })

  test('it silently ignores holdingAssociation, status, dateOnCPHFrom and q', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&holdingAssociation=Bogus&status=Dead&dateOnCPHFrom=2099-01-01&q=zzz&pageSize=100`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.totalRecords).toBe(KNOWN_CPH_CURRENT_COUNT)
  })

  test('it treats page values of zero or below as page 1', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&page=-3&pageSize=2`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.page).toBe(1)
    expect(earTagsOf(response)).toEqual([
      KNOWN_IDENTIFIER,
      PASSPORT_PROBLEM_IDENTIFIER
    ])
  })

  test('it clamps pageSize down to 100', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&pageSize=1000`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.result.pageSize).toBe(MAX_PAGE_SIZE)
  })

  test('it clamps pageSize up to 1', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&pageSize=0`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.result.pageSize).toBe(1)
    expect(response.result.animals).toHaveLength(1)
  })

  test('it returns 400 for a non-integer page', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&page=abc`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.title).toBe('Bad Request')
    expect(response.result.detail).toBe(
      'One or more validation errors occurred.'
    )
    expect(response.result.errors).toEqual({
      page: ["The value 'abc' is not valid for page."]
    })
  })

  test('it returns 400 for a non-integer pageSize', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&pageSize=1.5`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.title).toBe('Bad Request')
    expect(response.result.detail).toBe(
      'One or more validation errors occurred.'
    )
    expect(response.result.errors).toEqual({
      pageSize: ["The value '1.5' is not valid for pageSize."]
    })
  })

  test('it returns 400 for an invalid orderBy', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&orderBy=Status`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.title).toBe('Bad Request')
    expect(response.result.detail).toBe(
      'One or more validation errors occurred.'
    )
    expect(response.result.errors).toEqual({
      orderBy: ["The value 'Status' is not valid for orderBy."]
    })
  })

  test('it returns 400 for an invalid direction', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&direction=Up`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.title).toBe('Bad Request')
    expect(response.result.detail).toBe(
      'One or more validation errors occurred.'
    )
    expect(response.result.errors).toEqual({
      direction: ["The value 'Up' is not valid for direction."]
    })
  })

  test('it reports every binding error together', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?sex=x&page=y&pageSize=z&orderBy=o&direction=d`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(400)
    expect(response.result.title).toBe('Bad Request')
    expect(response.result.detail).toBe(
      'One or more validation errors occurred.'
    )
    expect(response.result.errors).toEqual({
      sex: ["The value 'x' is not valid for sex."],
      page: ["The value 'y' is not valid for page."],
      pageSize: ["The value 'z' is not valid for pageSize."],
      orderBy: ["The value 'o' is not valid for orderBy."],
      direction: ["The value 'd' is not valid for direction."],
      CPH: ['The CPH field is required.']
    })
  })

  test('it applies page and pageSize', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&page=2&pageSize=3`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.result).toMatchObject({
      page: 2,
      pageSize: 3,
      totalRecords: KNOWN_CPH_CURRENT_COUNT
    })
    expect(earTagsOf(response)).toEqual([
      'UK200000000004',
      'UK200000000005',
      'UK200000000006'
    ])
  })

  test('it returns an empty page past the end with locationName null and a zero count', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&page=99&pageSize=3`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.animals).toEqual([])
    expect(response.result.locationName).toBeNull()
    expect(response.result.totalRecords).toBe(0)
    expect(response.result.page).toBe(99)
  })

  test('it defaults status to Passport Produced', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&pageSize=1`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.result.animals[0].status).toBe('Passport Produced')
  })

  test('it returns the earStatus override from the fixture', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: `${LIST_URL}?CPH=${KNOWN_CPH}&pageSize=2`,
      headers: { authorization: VALID_AUTH_HEADER }
    })

    // Assert
    expect(response.result.animals[1].identifier.identifier).toBe(
      PASSPORT_PROBLEM_IDENTIFIER
    )
    expect(response.result.animals[1].status).toBe('Passport Problem')
  })
})
