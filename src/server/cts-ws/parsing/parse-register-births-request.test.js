import { describe, expect, test } from 'vitest'

import { parseRegisterBirthsRequest } from './parse-register-births-request.js'

describe('parseRegisterBirthsRequest()', () => {
  test('it extracts credentials, TxnId and each Birth row', () => {
    // Arrange
    const innerXml =
      '<RegBirths xmlns="http://defra.bcms.ctws/register_births_request" SchemaVersion="1.0" ProgramName="CTWSProg" ProgramVersion="1b" RequestTimeStamp="2026-01-01T00:00:00Z">' +
      // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- fake test fixture, not a real secret
      '<Authentication><CTS_OL_User Usr="cts-ol-user" Pwd="cts-ol-pass"/></Authentication>' +
      '<Births TxnId="txn-1">' +
      '<Birth RowNum="1" Etg="UK1" Dob="2020-01-01" Brd="HF" Sex="f" GdEtg="UK0" BLoc="01/001/0001" PLoc="01/001/0001" IWarn="n"/>' +
      '<Birth RowNum="2" Etg="UK2" Dob="2020-01-02" Brd="HF" Sex="m" GdEtg="UK0" BLoc="01/001/0001" PLoc="01/001/0001" IWarn="n"/>' +
      '</Births>' +
      '</RegBirths>'

    // Act
    const result = parseRegisterBirthsRequest(innerXml)

    // Assert
    expect(result.username).toBe('cts-ol-user')
    expect(result.password).toBe('cts-ol-pass')
    expect(result.txnId).toBe('txn-1')
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({
      rowNum: 1,
      attributes: {
        RowNum: '1',
        Etg: 'UK1',
        Dob: '2020-01-01',
        Brd: 'HF',
        Sex: 'f',
        GdEtg: 'UK0',
        BLoc: '01/001/0001',
        PLoc: '01/001/0001',
        IWarn: 'n'
      }
    })
  })

  test('it treats a single Birth row as a one-element array', () => {
    // Arrange
    const innerXml =
      '<RegBirths xmlns="http://defra.bcms.ctws/register_births_request">' +
      // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- fake test fixture, not a real secret
      '<Authentication><CTS_OL_User Usr="cts-ol-user" Pwd="cts-ol-pass"/></Authentication>' +
      '<Births TxnId="txn-1">' +
      '<Birth RowNum="1" Etg="UK1"/>' +
      '</Births>' +
      '</RegBirths>'

    // Act
    const result = parseRegisterBirthsRequest(innerXml)

    // Assert
    expect(result.rows).toHaveLength(1)
  })

  test('it throws when the payload is not a RegBirths request', () => {
    // Arrange
    const innerXml = '<SomethingElse/>'
    let error

    // Act
    try {
      parseRegisterBirthsRequest(innerXml)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error?.message).toBe(
      'Decoded data payload is not a RegBirths request'
    )
  })
})
