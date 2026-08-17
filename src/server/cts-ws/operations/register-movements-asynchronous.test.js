import { afterEach, describe, expect, test, vi } from 'vitest'
import { handle, type } from './register-movements-asynchronous.js'
import { DomainError } from '../errors/domain-error.js'
import { movementStore } from '../stores/movement.js'
import { parseRegisterMovementsRequest } from '../parsing/parse-register-movements-request.js'

vi.mock('../stores/movement.js')
vi.mock('../parsing/parse-register-movements-request.js')

const mocks = {
  movementStore: {
    hasSubmission: vi.mocked(movementStore.hasSubmission),
    submit: vi.mocked(movementStore.submit)
  },
  parseRegisterMovementsRequest: vi.mocked(parseRegisterMovementsRequest)
}

// Schema-valid RegMovs XML - real XSD validation still runs, so this has to
// conform even though parseRegisterMovementsRequest itself is mocked. Uses
// the real config defaults for CTS_OL_User credentials.
const validXml =
  '<RegMovs xmlns="http://defra.bcms.ctws/register_movements_request" SchemaVersion="1.0" ProgramName="CTWSProg" ProgramVersion="1b" RequestTimeStamp="2026-01-01T00:00:00Z">' +
  // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- fake test fixture, not a real secret
  '<Authentication><CTS_OL_User xmlns="" Usr="dev-cts-usr" Pwd="dev-cts-pass123"/></Authentication>' +
  '<Moves TxnId="txn-1"><Mov RowNum="1" Etg="UK1" Loc="01/001/0001" SLoc="04" MDate="2020-01-01" MType="on" RefNum="1" IWarn="n"/></Moves>' +
  '</RegMovs>'

const defaultPayload = {
  username: 'dev-cts-usr',
  // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- fake test fixture, not a real secret
  password: 'dev-cts-pass123',
  txnId: 'txn-1',
  rows: [{ rowNum: 1, attributes: { RowNum: '1' } }]
}

describe('register-movements-asynchronous', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('type is Register_Movements_Asynchronous-V1-0', () => {
    // Assert
    expect(type).toBe('Register_Movements_Asynchronous-V1-0')
  })

  test('handle submits the parsed batch to the movement store and returns a receipt', () => {
    // Arrange
    mocks.parseRegisterMovementsRequest.mockReturnValueOnce(defaultPayload)
    mocks.movementStore.submit.mockReturnValueOnce(42)

    // Act
    const result = handle(validXml)

    // Assert
    expect(result).toContain('<MsgReceipt')
    expect(result).toContain('Receipt Num="42"')
    expect(mocks.movementStore.submit).toHaveBeenCalledWith({
      username: 'dev-cts-usr',
      txnId: 'txn-1',
      rows: defaultPayload.rows
    })
  })

  test('handle throws a CTWS000 DomainError when the payload cannot be parsed', () => {
    // Arrange
    mocks.parseRegisterMovementsRequest.mockImplementationOnce(() => {
      throw new Error('not a RegMovs request')
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
    mocks.parseRegisterMovementsRequest.mockReturnValueOnce({
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
  })

  test('handle throws a CTWS808 DomainError for XML that does not conform to the register_movements_request XSD', () => {
    // Arrange - MType only allows the enum values on/off/death
    const badSchemaXml = validXml.replace('MType="on"', 'MType="sideways"')
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
    expect(mocks.parseRegisterMovementsRequest).not.toHaveBeenCalled()
  })

  test('handle throws a CTWS807 DomainError when the movement store reports the TxnId as already submitted', () => {
    // Arrange
    mocks.parseRegisterMovementsRequest.mockReturnValueOnce(defaultPayload)
    mocks.movementStore.hasSubmission.mockReturnValueOnce(true)
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
    expect(mocks.movementStore.submit).not.toHaveBeenCalled()
  })
})
