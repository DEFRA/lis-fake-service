import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const configValues = {
  'ctsWs.ctsOlUsername': 'cts-ol-user',
  'ctsWs.ctsOlPassword': 'cts-ol-pass',
  'nunjucks.noCache': true
}

vi.mock('../../../../config/config.js', () => ({
  config: { get: (key) => configValues[key] }
}))

const { handle, type } = await import('./index.js')
const { DomainError } = await import('../../errors/domain-error.js')
const { movementStore } = await import('../../stores/movement.js')

const acceptedRow = {
  rowNum: 1,
  attributes: {
    RowNum: '1',
    Etg: 'UK200000000001',
    Loc: '22/001/0001',
    MDate: '2020-01-01',
    MType: 'on',
    RefNum: '1',
    IWarn: 'n'
  }
}

const rejectedRow = {
  rowNum: 1,
  attributes: {
    RowNum: '1',
    Etg: 'UK999999999999',
    Loc: '22/001/0001',
    MDate: '2020-01-01',
    MType: 'on',
    RefNum: '1',
    IWarn: 'n'
  }
}

function buildInnerXml({
  username = 'cts-ol-user',
  password = 'cts-ol-pass',
  receiptNum
} = {}) {
  return (
    '<GetResults xmlns="http://defra.bcms.ctws/get_asynchronus_results" SchemaVersion="1.0" ProgramName="CTWSProg" ProgramVersion="1b" RequestTimeStamp="2026-01-01T00:00:00Z">' +
    `<Authentication><CTS_OL_User Usr="${username}" Pwd="${password}"/></Authentication>` +
    `<Receipt Num="${receiptNum}"/>` +
    '</GetResults>'
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('type is Get_Register_Movements_Validation_Results-V1-0', () => {
  // Assert
  expect(type).toBe('Get_Register_Movements_Validation_Results-V1-0')
})

test('handle accepts a row with a known ear tag and an active, suitable location once results are ready', () => {
  // Arrange
  const receiptNum = movementStore.submit({
    txnId: 'txn-1',
    rows: [acceptedRow]
  })
  vi.advanceTimersByTime(5000)
  const innerXml = buildInnerXml({ receiptNum })

  // Act
  const result = handle(innerXml)

  // Assert
  expect(result).toContain('<Accept RowNum="1"/>')
  expect(result).not.toContain('<Rejected>')
})

test('handle rejects a row with an unrecognised ear tag as CTWS307 once results are ready', () => {
  // Arrange
  const receiptNum = movementStore.submit({
    txnId: 'txn-1',
    rows: [rejectedRow]
  })
  vi.advanceTimersByTime(5000)
  const innerXml = buildInnerXml({ receiptNum })

  // Act
  const result = handle(innerXml)

  // Assert
  expect(result).toContain('RowNum="1"')
  expect(result).toContain('CTWS307')
  expect(result).toContain('Ear Tag Not Found')
})

test('handle throws a CTWS806 DomainError while the store has not yet validated the submission', () => {
  // Arrange
  const receiptNum = movementStore.submit({
    txnId: 'txn-1',
    rows: [acceptedRow]
  })
  const innerXml = buildInnerXml({ receiptNum })
  let error

  // Act
  try {
    handle(innerXml)
  } catch (e) {
    error = e
  }

  // Assert
  expect(error).toBeInstanceOf(DomainError)
  expect(error?.exNum).toBe('CTWS806')
})

test('handle throws a DomainError for invalid credentials', () => {
  // Arrange
  const receiptNum = movementStore.submit({ txnId: 'txn-1', rows: [] })
  vi.advanceTimersByTime(5000)
  const innerXml = buildInnerXml({ receiptNum, username: 'wrong' })
  let error

  // Act
  try {
    handle(innerXml)
  } catch (e) {
    error = e
  }

  // Assert
  expect(error).toBeInstanceOf(DomainError)
  expect(error?.message).toBe('Authentication failed')
})

test('handle throws a DomainError when the receipt does not exist', () => {
  // Arrange
  const innerXml = buildInnerXml({ receiptNum: 999_999 })
  let error

  // Act
  try {
    handle(innerXml)
  } catch (e) {
    error = e
  }

  // Assert
  expect(error).toBeInstanceOf(DomainError)
  expect(error?.message).toContain('not found')
})
