import { afterEach, describe, expect, test, vi } from 'vitest'
import { handle, type } from './get-register-births-validation-results.js'
import { DomainError } from '../errors/domain-error.js'
import { birthStore } from '../stores/birth.js'
import { parseGetResultsRequest } from '../parsing/parse-get-results-request.js'

vi.mock('../stores/birth.js')
vi.mock('../parsing/parse-get-results-request.js')

const mocks = {
  birthStore: {
    retrieveResults: vi.mocked(birthStore.retrieveResults)
  },
  parseGetResultsRequest: vi.mocked(parseGetResultsRequest)
}

// Schema-valid GetResults XML - real XSD validation still runs, so this has
// to conform even though parseGetResultsRequest itself is mocked. Uses the
// real config defaults for CTS_OL_User credentials.
const validXml =
  '<GetResults xmlns="http://defra.bcms.ctws/get_asynchronus_results" SchemaVersion="1.0" ProgramName="CTWSProg" ProgramVersion="1b" RequestTimeStamp="2026-01-01T00:00:00Z">' +
  // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- fake test fixture, not a real secret
  '<Authentication><CTS_OL_User xmlns="" Usr="dev-cts-usr" Pwd="dev-cts-pass123"/></Authentication>' +
  '<Receipt Num="1"/>' +
  '</GetResults>'

const defaultPayload = {
  username: 'dev-cts-usr',
  // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- fake test fixture, not a real secret
  password: 'dev-cts-pass123',
  receiptNum: 1
}

describe('get-register-births-validation-results', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('type is Get_Register_Births_Validation_Results-V1-0', () => {
    // Assert
    expect(type).toBe('Get_Register_Births_Validation_Results-V1-0')
  })

  test('handle renders the accepted/rejected rows once the store reports results ready', () => {
    // Arrange
    mocks.parseGetResultsRequest.mockReturnValueOnce(defaultPayload)
    mocks.birthStore.retrieveResults.mockReturnValueOnce({
      ready: true,
      results: {
        txnId: 'txn-1',
        accepted: [1],
        rejected: [
          {
            attributes: { RowNum: '2', Etg: '' },
            causes: [
              {
                code: 'CTWS003',
                desc: 'Missing Ear Tag',
                sev: 'e',
                field: 'Etg'
              }
            ]
          }
        ]
      }
    })

    // Act
    const result = handle(validXml)

    // Assert
    expect(result).toContain('<Accept RowNum="1"/>')
    expect(result).toContain('RowNum="2"')
    expect(result).toContain('CTWS003')
    expect(result).toContain('Missing Ear Tag')
    expect(mocks.birthStore.retrieveResults).toHaveBeenCalledWith(1)
  })

  test('handle throws a CTWS000 DomainError when the payload cannot be parsed', () => {
    // Arrange
    mocks.parseGetResultsRequest.mockImplementationOnce(() => {
      throw new Error('not a GetResults request')
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
    mocks.parseGetResultsRequest.mockReturnValueOnce({
      ...defaultPayload,
      password: 'wrong'
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
    expect(mocks.birthStore.retrieveResults).not.toHaveBeenCalled()
  })

  test('handle throws a CTWS808 DomainError for XML that does not conform to the get_asynchronous_results XSD', () => {
    // Arrange - Receipt Num must be an integer (ReceiptId_Type)
    const badSchemaXml = validXml.replace('Num="1"', 'Num="not-a-number"')
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
    expect(mocks.parseGetResultsRequest).not.toHaveBeenCalled()
  })

  test('handle throws a CTWS806 DomainError while the store has not yet validated the submission', () => {
    // Arrange
    mocks.parseGetResultsRequest.mockReturnValueOnce(defaultPayload)
    mocks.birthStore.retrieveResults.mockReturnValueOnce({ ready: false })
    let error

    // Act
    try {
      handle(validXml)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).toBeInstanceOf(DomainError)
    expect(error?.exNum).toBe('CTWS806')
  })

  test('handle throws a DomainError when the receipt does not exist', () => {
    // Arrange
    mocks.parseGetResultsRequest.mockReturnValueOnce(defaultPayload)
    mocks.birthStore.retrieveResults.mockReturnValueOnce(undefined)
    let error

    // Act
    try {
      handle(validXml)
    } catch (e) {
      error = e
    }

    // Assert
    expect(error).toBeInstanceOf(DomainError)
    expect(error?.message).toContain('not found')
  })
})
