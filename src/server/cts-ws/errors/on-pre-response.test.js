import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'
import { config } from '../../../config/config.js'
import { onPreResponse } from './on-pre-response.js'
import { decodeDataPayload } from '../xml/soap-envelope.js'
import { DomainError } from './domain-error.js'
import { MalformedRequestError } from './malformed-request-error.js'
import { TransportFaultError } from './transport-fault-error.js'

const configValues = {
  'nunjucks.noCache': true,
  isProduction: false
}

const mocks = vi.hoisted(() => ({
  loggerError: vi.fn()
}))

vi.mock('../../common/helpers/logging/logger.js', () => ({
  logger: { error: mocks.loggerError }
}))

mocks.configGet = vi.spyOn(config, 'get')

function makeH() {
  const h = {
    response: vi.fn(() => h),
    type: vi.fn(() => h),
    code: vi.fn(() => h),
    continue: Symbol('continue')
  }
  return h
}

describe('onPreResponse', () => {
  beforeAll(() => {
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    configValues.isProduction = false
  })

  test('it renders a SystemException for a DomainError, wrapped in a 200 envelope', () => {
    // Arrange
    const request = {
      response: new DomainError('CTWS810', 'Holding not found')
    }
    const h = makeH()

    // Act
    onPreResponse(request, h)

    // Assert
    expect(h.type).toHaveBeenCalledWith('text/xml')
    expect(h.code).toHaveBeenCalledWith(200)
    const [responseXml] = h.response.mock.calls[0]
    const resultMatch = responseXml.match(
      /<TransferDataHexResult>(.*?)<\/TransferDataHexResult>/
    )
    const decodedResult = decodeDataPayload(resultMatch[1])
    expect(decodedResult).toContain('ExNum="CTWS810"')
    expect(decodedResult).toContain('ExMsg="Holding not found"')
  })

  test('it renders a SOAP fault for a TransportFaultError, with a 500', () => {
    // Arrange
    const request = {
      response: new TransportFaultError('soap:Client', 'Authentication failed')
    }
    const h = makeH()

    // Act
    onPreResponse(request, h)

    // Assert
    expect(h.type).toHaveBeenCalledWith('text/xml')
    expect(h.code).toHaveBeenCalledWith(500)
    const [responseXml] = h.response.mock.calls[0]
    expect(responseXml).toContain('<soap:Fault>')
    expect(responseXml).toContain('<faultcode>soap:Client</faultcode>')
    expect(responseXml).toContain(
      '<faultstring>Authentication failed</faultstring>'
    )
  })

  test('it returns an empty 400 for a MalformedRequestError', () => {
    // Arrange
    const request = { response: new MalformedRequestError('bad envelope') }
    const h = makeH()

    // Act
    onPreResponse(request, h)

    // Assert
    expect(h.response).toHaveBeenCalledWith()
    expect(h.code).toHaveBeenCalledWith(400)
  })

  test('it passes through any other response unchanged', () => {
    // Arrange
    const request = { response: { some: 'success response' } }
    const h = makeH()

    // Act
    const result = onPreResponse(request, h)

    // Assert
    expect(result).toBe(h.continue)
    expect(h.response).not.toHaveBeenCalled()
  })

  test('it returns a generic SOAP fault and logs the error for an unmodelled failure', () => {
    // Arrange
    const error = new Error('something broke unexpectedly')
    error.isBoom = true
    const request = { response: error }
    const h = makeH()

    // Act
    onPreResponse(request, h)

    // Assert
    expect(h.type).toHaveBeenCalledWith('text/xml')
    expect(h.code).toHaveBeenCalledWith(500)
    const [responseXml] = h.response.mock.calls[0]
    expect(responseXml).toContain('<faultcode>soap:Server</faultcode>')
    expect(responseXml).toContain(
      '<faultstring>something broke unexpectedly</faultstring>'
    )
    expect(mocks.loggerError).toHaveBeenCalledWith(error.stack)
  })

  test('it hides the real error message behind a generic one in production', () => {
    // Arrange
    configValues.isProduction = true
    const error = new Error('something broke unexpectedly')
    error.isBoom = true
    const request = { response: error }
    const h = makeH()

    // Act
    onPreResponse(request, h)

    // Assert
    const [responseXml] = h.response.mock.calls[0]
    expect(responseXml).toContain(
      '<faultstring>Internal Server Error</faultstring>'
    )
  })
})
