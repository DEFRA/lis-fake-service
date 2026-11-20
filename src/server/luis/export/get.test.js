import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import hapi from '@hapi/hapi'
import { config } from '../../../config/config.js'
import { luis } from '../index.js'
import { createToken } from '../token.js'

const EXPORT_PATH = '/luis/Hsa/1.0/Export'
const TODAY = new Date('2026-11-20T10:00:00Z')

const configValues = {
  'luis.tokenSecret': 'test-secret',
  'luis.exportDays': 30,
  'luis.tagsPerDay': 1
}

const mocks = {
  configGet: vi.spyOn(config, 'get')
}

const originalGet = config.get.bind(config)

async function makeServer() {
  const server = hapi.server()
  await server.register(luis)
  return server
}

function bearer() {
  return `Bearer ${createToken({ userId: 'user', callerId: 'caller' })}`
}

describe('GET /luis/Hsa/{v}/Export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(TODAY)
    mocks.configGet.mockImplementation((key) =>
      key in configValues ? configValues[key] : originalGet(key)
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('it returns 401 with an empty body without an Authorization header', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({ method: 'GET', url: EXPORT_PATH })

    // Assert
    expect(response.statusCode).toBe(401)
    expect(response.payload).toBe('')
  })

  test('it returns 401 for a token with a bad signature', async () => {
    // Arrange
    const server = await makeServer()
    const token = createToken({ userId: 'user', callerId: 'caller' })

    // Act
    const response = await server.inject({
      method: 'GET',
      url: EXPORT_PATH,
      headers: { authorization: `Bearer ${token}x` }
    })

    // Assert
    expect(response.statusCode).toBe(401)
  })

  test('it returns 401 for an expired token', async () => {
    // Arrange
    const server = await makeServer()
    const authorization = bearer()
    vi.setSystemTime(new Date(TODAY.getTime() + 31 * 60 * 1000))

    // Act
    const response = await server.inject({
      method: 'GET',
      url: EXPORT_PATH,
      headers: { authorization }
    })

    // Assert
    expect(response.statusCode).toBe(401)
  })

  test('it returns 401 for a non-Bearer scheme', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: EXPORT_PATH,
      headers: { authorization: 'Basic abc' }
    })

    // Assert
    expect(response.statusCode).toBe(401)
  })

  test('it returns two records per herd per day for the export window with the documented shape', async () => {
    // Arrange
    const server = await makeServer()

    // Act
    const response = await server.inject({
      method: 'GET',
      url: EXPORT_PATH,
      headers: { authorization: bearer() }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    expect(response.result.Records).toBe(600)
    expect(response.result.Tags).toHaveLength(600)
    expect(response.result.Further).toBe(false)
    expect(Object.keys(response.result.Tags[0])).toEqual([
      'Entity_Type',
      'Entity_Id',
      'Export_Id',
      'Status',
      'Country',
      'CPH',
      'Herd',
      'For_Tag',
      'Tag_Replica_Count',
      'Replacement',
      'Order_Type_Id',
      'Order_Date',
      'Species',
      'Defra_Ref',
      'Colour',
      'Species_Iso',
      'Replica_Count_Display',
      'Tag',
      'Manufacturer',
      'Approved_Tag',
      'KeeperDetails'
    ])
  })
})
