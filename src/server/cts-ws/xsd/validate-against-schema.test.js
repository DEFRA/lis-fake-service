import { describe, expect, test } from 'vitest'

import { validateAgainstSchema } from './validate-against-schema.js'

const validRegBirths =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<RegBirths xmlns="http://defra.bcms.ctws/register_births_request" SchemaVersion="1.0" ProgramName="CTWSProg" ProgramVersion="1b" RequestTimeStamp="2026-01-01T00:00:00Z">' +
  // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- fake test fixture, not a real secret
  '<Authentication><CTS_OL_User xmlns="" Usr="111-111-111" Pwd="m0nster"/></Authentication>' +
  '<Births TxnId="txn-1">' +
  '<Birth RowNum="1" Etg="UK000000000001" Dob="2020-01-01" Brd="HF" Sex="f" GdEtg="UK000000000000" BLoc="01/001/0001" PLoc="01/001/0001" IWarn="n"/>' +
  '</Births></RegBirths>'

describe('validateAgainstSchema()', () => {
  test('validateAgainstSchema accepts a real-shaped RegBirths document', () => {
    // Act
    const result = validateAgainstSchema(
      validRegBirths,
      'register_births_request-V1-0.xsd'
    )

    // Assert
    expect(result).toEqual({ wellFormed: true, valid: true })
  })

  test('validateAgainstSchema rejects a RegBirths document with an invalid breed code', () => {
    // Arrange
    const xml = validRegBirths.replace('Brd="HF"', 'Brd="not-a-code"')

    // Act
    const result = validateAgainstSchema(
      xml,
      'register_births_request-V1-0.xsd'
    )

    // Assert
    expect(result).toEqual({ wellFormed: true, valid: false })
  })

  test('validateAgainstSchema reports XML that is not well-formed as not well-formed', () => {
    // Act
    const result = validateAgainstSchema(
      '<not-closed>',
      'register_births_request-V1-0.xsd'
    )

    // Assert
    expect(result).toEqual({ wellFormed: false, valid: false })
  })

  test('validateAgainstSchema rejects a RegBirths document missing the required Births element', () => {
    // Arrange
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<RegBirths xmlns="http://defra.bcms.ctws/register_births_request" SchemaVersion="1.0" ProgramName="CTWSProg" ProgramVersion="1b" RequestTimeStamp="2026-01-01T00:00:00Z">' +
      // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- fake test fixture, not a real secret
      '<Authentication><CTS_OL_User xmlns="" Usr="111-111-111" Pwd="m0nster"/></Authentication>' +
      '</RegBirths>'

    // Act
    const result = validateAgainstSchema(
      xml,
      'register_births_request-V1-0.xsd'
    )

    // Assert
    expect(result).toEqual({ wellFormed: true, valid: false })
  })
})
