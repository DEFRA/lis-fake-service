import { describe, expect, test } from 'vitest'

import { parseGetResultsRequest } from './parse-get-results-request.js'

describe('parseGetResultsRequest()', () => {
  test('it extracts credentials and the receipt number', () => {
    // Arrange
    const innerXml =
      '<GetResults xmlns="http://defra.bcms.ctws/get_asynchronus_results" SchemaVersion="1.0" ProgramName="CTWSProg" ProgramVersion="1b" RequestTimeStamp="2026-01-01T00:00:00Z">' +
      // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- fake test fixture, not a real secret
      '<Authentication><CTS_OL_User Usr="cts-ol-user" Pwd="cts-ol-pass"/></Authentication>' +
      '<Receipt Num="42"/>' +
      '</GetResults>'

    // Act
    const result = parseGetResultsRequest(innerXml)

    // Assert
    expect(result).toEqual({
      username: 'cts-ol-user',
      password: 'cts-ol-pass',
      receiptNum: 42
    })
  })

  test('it throws when the payload is not a GetResults request', () => {
    // Arrange
    const innerXml = '<SomethingElse/>'
    let error

    // Act
    try {
      parseGetResultsRequest(innerXml)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error?.message).toBe(
      'Decoded data payload is not a GetResults request'
    )
  })
})
