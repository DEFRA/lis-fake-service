import { describe, expect, test } from 'vitest'

import { MalformedRequestError } from '../errors/malformed-request-error.js'
import { parseTransferDataHexRequestPreHandler } from './parse-transfer-data-hex-request-pre-handler.js'

function makeRequest(payload) {
  return { payload: Buffer.from(payload, 'utf-8') }
}

describe('parseTransferDataHexRequestPreHandler()', () => {
  test('it parses a valid TransferDataHex SOAP envelope into its constituent fields', () => {
    // Arrange
    const xml =
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
      '<soap:Body>' +
      '<TransferDataHex xmlns="http://www.defra.gov.uk">' +
      '<username>dth-user</username>' +
      '<password>dth-pass-hash</password>' +
      '<serviceName>DEFRA-CTWS-FULL-PROVING</serviceName>' +
      '<data>ZGF0YQ==</data>' +
      '<type>Register_Births_Asynchronous-V1-0</type>' +
      '</TransferDataHex>' +
      '</soap:Body>' +
      '</soap:Envelope>'
    const request = makeRequest(xml)

    // Act
    const result = parseTransferDataHexRequestPreHandler(request)

    // Assert
    expect(result).toEqual({
      username: 'dth-user',
      password: 'dth-pass-hash',
      serviceName: 'DEFRA-CTWS-FULL-PROVING',
      data: 'ZGF0YQ==',
      type: 'Register_Births_Asynchronous-V1-0'
    })
  })

  test('it throws a MalformedRequestError for well-formed XML that is not a TransferDataHex envelope', () => {
    // Arrange
    const request = makeRequest('<not-soap/>')
    let error

    // Act
    try {
      parseTransferDataHexRequestPreHandler(request)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).toBeInstanceOf(MalformedRequestError)
    expect(error?.message).toBe(
      'Request body is not a valid TransferDataHex SOAP envelope'
    )
  })

  test('it throws a MalformedRequestError for a body that is not well-formed XML', () => {
    // Arrange
    const request = makeRequest('<soap:Envelope><soap:Body>')
    let error

    // Act
    try {
      parseTransferDataHexRequestPreHandler(request)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).toBeInstanceOf(MalformedRequestError)
  })
})
