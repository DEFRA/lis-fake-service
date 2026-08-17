import crypto from 'node:crypto'

import { afterEach, expect, test, vi } from 'vitest'

const configValues = {
  'ctsWs.dthUsername': 'dth-user',
  'ctsWs.dthPassword': 'dth-pass',
  'ctsWs.ctsOlUsername': 'cts-ol-user',
  'ctsWs.ctsOlPassword': 'cts-ol-pass',
  'ctsWs.serviceUnavailableProbability': 0,
  'nunjucks.noCache': true
}

vi.mock('../../config/config.js', () => ({
  config: { get: (key) => configValues[key] }
}))

const { transferDataHexHandler } = await import('./controller.js')
const { decodeDataPayload, encodeDataPayload } =
  await import('./xml/soap-envelope.js')
const { DomainError } = await import('./errors/domain-error.js')
const { TransportFaultError } =
  await import('./errors/transport-fault-error.js')

// Matches the real service's MD5-hashed password scheme - test-only, not a security control.
function md5(value) {
  // eslint-disable-next-line sonarjs/hashing
  return crypto.createHash('md5').update(value, 'ascii').digest('hex')
}

function buildTransferDataHexRequest({
  dthUsername = 'dth-user',
  dthPassword = 'dth-pass',
  type = 'Register_Births_Asynchronous-V1-0',
  ctsOlUsername = 'cts-ol-user',
  ctsOlPassword = 'cts-ol-pass'
} = {}) {
  const innerXml =
    '<RegBirths xmlns="http://defra.bcms.ctws/register_births_request" SchemaVersion="1.0" ProgramName="CTWSProg" ProgramVersion="1b" RequestTimeStamp="2026-01-01T00:00:00Z">' +
    `<Authentication><CTS_OL_User xmlns="" Usr="${ctsOlUsername}" Pwd="${ctsOlPassword}"/></Authentication>` +
    '<Births TxnId="txn-1">' +
    '<Birth RowNum="1" Etg="UK000000000001" Dob="2020-01-01" Brd="HF" Sex="f" GdEtg="UK000000000000" BLoc="01/001/0001" PLoc="01/001/0001" IWarn="n"/>' +
    '</Births>' +
    '</RegBirths>'

  return {
    username: dthUsername,
    password: md5(dthPassword),
    serviceName: 'DEFRA-CTWS-FULL-PROVING',
    data: encodeDataPayload(
      `<?xml version="1.0" encoding="utf-8"?>${innerXml}`
    ),
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

afterEach(() => {
  configValues['ctsWs.serviceUnavailableProbability'] = 0
})

test('it returns a successful MsgReceipt payload for a supported type', () => {
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
})

test('it propagates the DomainError an operation throws for invalid inner credentials', () => {
  // Arrange
  const request = makeRequest(
    buildTransferDataHexRequest({ ctsOlUsername: 'wrong' })
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
  expect(error?.exNum).toBe('CTWS001')
})

test('it throws a CTWS809 DomainError when the simulated outage roll lands', () => {
  // Arrange
  configValues['ctsWs.serviceUnavailableProbability'] = 1
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
})
