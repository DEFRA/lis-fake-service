import crypto from 'node:crypto'

import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { config } from '../../config/config.js'
import { transferDataHexHandler } from './controller.js'
import { decodeDataPayload, encodeDataPayload } from './xml/soap-envelope.js'
import { DomainError } from './errors/domain-error.js'
import { TransportFaultError } from './errors/transport-fault-error.js'
import { getOperation } from './operations/index.js'

let serviceUnavailableProbability = 0
const realConfigGet = config.get.bind(config)

vi.mock('./operations/index.js')

const mocks = {
  configGet: vi.spyOn(config, 'get'),
  getOperation: vi.mocked(getOperation),
  operationHandle: vi.fn()
}

// Matches the real service's MD5-hashed password scheme - test-only, not a security control.
function md5(value) {
  // eslint-disable-next-line sonarjs/hashing
  return crypto.createHash('md5').update(value, 'ascii').digest('hex')
}

function buildTransferDataHexRequest({
  dthUsername = config.get('ctsWs.dthUsername'),
  dthPassword = config.get('ctsWs.dthPassword'),
  type = 'Register_Births_Asynchronous-V1-0'
} = {}) {
  return {
    username: dthUsername,
    password: md5(dthPassword),
    serviceName: 'DEFRA-CTWS-FULL-PROVING',
    data: encodeDataPayload('<?xml version="1.0" encoding="utf-8"?><Fake/>'),
    type
  }
}

function makeRequest(transferDataHexRequest) {
  return { pre: { transferDataHexRequest } }
}

function makeH() {
  const h = {
    response: vi.fn(() => h),
    type: vi.fn(() => h),
    code: vi.fn(() => h)
  }
  return h
}

describe('transferDataHexHandler', () => {
  beforeAll(() => {
    mocks.configGet.mockImplementation((key) =>
      key === 'ctsWs.serviceUnavailableProbability'
        ? serviceUnavailableProbability
        : realConfigGet(key)
    )
    mocks.getOperation.mockReturnValue({
      type: 'Register_Births_Asynchronous-V1-0',
      handle: mocks.operationHandle
    })
    mocks.operationHandle.mockReturnValue(
      '<MsgReceipt><Receipt Num="1"/></MsgReceipt>'
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
    serviceUnavailableProbability = 0
  })

  test("it returns the operation handler's result for a supported type", () => {
    // Arrange
    const request = makeRequest(buildTransferDataHexRequest())
    const h = makeH()

    // Act
    transferDataHexHandler(request, h)

    // Assert
    expect(h.type).toHaveBeenCalledWith('text/xml')
    expect(h.code).toHaveBeenCalledWith(200)
    const [responseXml] = h.response.mock.calls[0]
    const resultMatch = responseXml.match(
      /<TransferDataHexResult>(.*?)<\/TransferDataHexResult>/
    )
    const decodedResult = decodeDataPayload(resultMatch[1])
    expect(decodedResult).toContain('<MsgReceipt')
  })

  test('it throws a TransportFaultError for an invalid outer username', () => {
    // Arrange
    const request = makeRequest(
      buildTransferDataHexRequest({ dthUsername: 'wrong' })
    )
    const h = makeH()
    let error

    // Act
    try {
      transferDataHexHandler(request, h)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).toBeInstanceOf(TransportFaultError)
    expect(error?.message).toBe('Authentication failed')
    expect(mocks.operationHandle).not.toHaveBeenCalled()
  })

  test('it throws a TransportFaultError for an invalid outer password', () => {
    // Arrange
    const request = makeRequest(
      buildTransferDataHexRequest({ dthPassword: 'wrong' })
    )
    const h = makeH()
    let error

    // Act
    try {
      transferDataHexHandler(request, h)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).toBeInstanceOf(TransportFaultError)
  })

  test('it throws a DomainError for an unsupported type', () => {
    // Arrange
    mocks.getOperation.mockReturnValueOnce(undefined)
    const request = makeRequest(
      buildTransferDataHexRequest({ type: 'Something-Else-V1-0' })
    )
    const h = makeH()
    let error

    // Act
    try {
      transferDataHexHandler(request, h)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).toBeInstanceOf(DomainError)
    expect(error?.message).toContain('Unsupported service type')
    expect(mocks.operationHandle).not.toHaveBeenCalled()
  })

  test('it propagates the DomainError the dispatched operation throws', () => {
    // Arrange
    mocks.operationHandle.mockImplementationOnce(() => {
      throw new DomainError('CTWS001', 'Authentication failed')
    })
    const request = makeRequest(buildTransferDataHexRequest())
    const h = makeH()
    let error

    // Act
    try {
      transferDataHexHandler(request, h)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).toBeInstanceOf(DomainError)
    expect(error?.exNum).toBe('CTWS001')
  })

  test('it throws a CTWS809 DomainError when the simulated outage roll lands', () => {
    // Arrange
    serviceUnavailableProbability = 1
    const request = makeRequest(buildTransferDataHexRequest())
    const h = makeH()
    let error

    // Act
    try {
      transferDataHexHandler(request, h)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).toBeInstanceOf(DomainError)
    expect(error?.exNum).toBe('CTWS809')
    expect(mocks.operationHandle).not.toHaveBeenCalled()
  })
})
