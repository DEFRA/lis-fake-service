import { describe, expect, test } from 'vitest'

import { parseRegisterMovementsRequest } from './parse-register-movements-request.js'

describe('parseRegisterMovementsRequest()', () => {
  test('it extracts credentials, TxnId and each Mov row', () => {
    // Arrange
    const innerXml =
      '<RegMovs xmlns="http://defra.bcms.ctws/register_movements_request" SchemaVersion="1.0" ProgramName="CTWSProg" ProgramVersion="1b" RequestTimeStamp="2026-01-01T00:00:00Z">' +
      // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- fake test fixture, not a real secret
      '<Authentication><CTS_OL_User Usr="cts-ol-user" Pwd="cts-ol-pass"/></Authentication>' +
      '<Moves TxnId="txn-1">' +
      '<Mov RowNum="1" Etg="UK1" Loc="01/001/0001" SLoc="04" MDate="2020-01-01" MType="on" RefNum="1" IWarn="n"/>' +
      '</Moves>' +
      '</RegMovs>'

    // Act
    const result = parseRegisterMovementsRequest(innerXml)

    // Assert
    expect(result.username).toBe('cts-ol-user')
    expect(result.password).toBe('cts-ol-pass')
    expect(result.txnId).toBe('txn-1')
    expect(result.rows).toEqual([
      {
        rowNum: 1,
        attributes: {
          RowNum: '1',
          Etg: 'UK1',
          Loc: '01/001/0001',
          SLoc: '04',
          MDate: '2020-01-01',
          MType: 'on',
          RefNum: '1',
          IWarn: 'n'
        }
      }
    ])
  })

  test('it throws when the payload is not a RegMovs request', () => {
    // Arrange
    const innerXml = '<SomethingElse/>'
    let error

    // Act
    try {
      parseRegisterMovementsRequest(innerXml)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error?.message).toBe('Decoded data payload is not a RegMovs request')
  })
})
