import { afterEach, describe, expect, test, vi } from 'vitest'
import { handle, type } from './register-births-asynchronous.js'
import { DomainError } from '../errors/domain-error.js'
import { birthStore } from '../stores/birth.js'
import { parseRegisterBirthsRequest } from '../parsing/parse-register-births-request.js'

vi.mock('../stores/birth.js')
vi.mock('../parsing/parse-register-births-request.js')

const mocks = {
  birthStore: {
    hasSubmission: vi.mocked(birthStore.hasSubmission),
    submit: vi.mocked(birthStore.submit)
  },
  parseRegisterBirthsRequest: vi.mocked(parseRegisterBirthsRequest)
}

// Schema-valid RegBirths XML - real XSD validation still runs, so this has
// to conform even though parseRegisterBirthsRequest itself is mocked. Uses
// the real config defaults for CTS_OL_User credentials.
const validXml =
  '<RegBirths xmlns="http://defra.bcms.ctws/register_births_request" SchemaVersion="1.0" ProgramName="CTWSProg" ProgramVersion="1b" RequestTimeStamp="2026-01-01T00:00:00Z">' +
  // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- fake test fixture, not a real secret
  '<Authentication><CTS_OL_User xmlns="" Usr="dev-cts-usr" Pwd="dev-cts-pass123"/></Authentication>' +
  '<Births TxnId="txn-1"><Birth RowNum="1" Etg="UK000000000001" Dob="2020-01-01" Brd="HF" Sex="f" GdEtg="UK000000000000" BLoc="01/001/0001" PLoc="01/001/0001" IWarn="n"/></Births>' +
  '</RegBirths>'

const defaultPayload = {
  username: 'dev-cts-usr',
  // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- fake test fixture, not a real secret
  password: 'dev-cts-pass123',
  txnId: 'txn-1',
  rows: [{ rowNum: 1, attributes: { RowNum: '1' } }]
}

describe('register-births-asynchronous', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('type is Register_Births_Asynchronous-V1-0', () => {
    // Assert
    expect(type).toBe('Register_Births_Asynchronous-V1-0')
  })

  test('handle submits the parsed batch to the birth store and returns a receipt', () => {
    // Arrange
    mocks.parseRegisterBirthsRequest.mockReturnValueOnce(defaultPayload)
    mocks.birthStore.submit.mockReturnValueOnce(42)

    // Act
    const result = handle(validXml)

    // Assert
    expect(result).toContain('<MsgReceipt')
    expect(result).toContain('Receipt Num="42"')
    expect(mocks.birthStore.submit).toHaveBeenCalledWith({
      username: 'dev-cts-usr',
      txnId: 'txn-1',
      rows: defaultPayload.rows
    })
  })

  test('handle throws a CTWS000 DomainError when the payload cannot be parsed', () => {
    // Arrange
    mocks.parseRegisterBirthsRequest.mockImplementationOnce(() => {
      throw new Error('not a RegBirths request')
    })
    let error

    // Act
    try {
      handle(validXml)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).toBeInstanceOf(DomainError)
    expect(error?.exNum).toBe('CTWS000')
  })

  test('handle throws a DomainError for invalid credentials', () => {
    // Arrange
    mocks.parseRegisterBirthsRequest.mockReturnValueOnce({
      ...defaultPayload,
      username: 'wrong'
    })
    let error

    // Act
    try {
      handle(validXml)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).toBeInstanceOf(DomainError)
    expect(error?.message).toBe('Authentication failed')
  })

  test('handle throws a CTWS808 DomainError for XML that does not conform to the register_births_request XSD', () => {
    // Arrange - an invalid (lowercase) breed code violates BreedCode_Type's pattern
    const badSchemaXml = validXml.replace('Brd="HF"', 'Brd="not-a-code"')
    let error

    // Act
    try {
      handle(badSchemaXml)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).toBeInstanceOf(DomainError)
    expect(error?.exNum).toBe('CTWS808')
    expect(mocks.parseRegisterBirthsRequest).not.toHaveBeenCalled()
  })

  test('handle throws a CTWS807 DomainError when the birth store reports the TxnId as already submitted', () => {
    // Arrange
    mocks.parseRegisterBirthsRequest.mockReturnValueOnce(defaultPayload)
    mocks.birthStore.hasSubmission.mockReturnValueOnce(true)
    let error

    // Act
    try {
      handle(validXml)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).toBeInstanceOf(DomainError)
    expect(error?.exNum).toBe('CTWS807')
    expect(mocks.birthStore.submit).not.toHaveBeenCalled()
  })
})
