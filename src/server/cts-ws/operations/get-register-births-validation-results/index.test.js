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
const { birthStore } = await import('../../stores/birth.js')

const acceptedRow = {
  rowNum: 1,
  attributes: {
    RowNum: '1',
    Etg: 'UK100000000001',
    Dob: '2026-01-01',
    Brd: 'HF',
    Sex: 'f',
    GdEtg: 'UK200000000007',
    BLoc: '22/001/0001',
    PLoc: '22/001/0001',
    IWarn: 'n'
  }
}

const missingEarTagRow = {
  rowNum: 1,
  attributes: {
    RowNum: '1',
    Etg: '',
    Dob: '2026-01-01',
    Brd: 'HF',
    Sex: 'f',
    GdEtg: 'UK200000000007',
    BLoc: '22/001/0001',
    PLoc: '22/001/0001',
    IWarn: 'n'
  }
}

// Uses the excessive-calving fixture dam (UK300000000003 has four calving
// dates all within 240 days of this Dob).
const excessiveCalvingRow = {
  rowNum: 1,
  attributes: {
    RowNum: '1',
    Etg: 'UK100000000002',
    Dob: '2026-05-01',
    Brd: 'HF',
    Sex: 'f',
    GdEtg: 'UK300000000003',
    BLoc: '22/001/0001',
    PLoc: '22/001/0001',
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

test('type is Get_Register_Births_Validation_Results-V1-0', () => {
  // Assert
  expect(type).toBe('Get_Register_Births_Validation_Results-V1-0')
})

test('handle accepts a row with no matching cause once results are ready', () => {
  // Arrange
  const receiptNum = birthStore.submit({ txnId: 'txn-1', rows: [acceptedRow] })
  vi.advanceTimersByTime(5000)
  const innerXml = buildInnerXml({ receiptNum })

  // Act
  const result = handle(innerXml)

  // Assert
  expect(result).toContain('<Accept RowNum="1"/>')
  expect(result).not.toContain('<Rejected>')
})

test('handle rejects a row missing its ear tag as CTWS003 once results are ready', () => {
  // Arrange
  const receiptNum = birthStore.submit({
    txnId: 'txn-1',
    rows: [missingEarTagRow]
  })
  vi.advanceTimersByTime(5000)
  const innerXml = buildInnerXml({ receiptNum })

  // Act
  const result = handle(innerXml)

  // Assert
  expect(result).toContain('RowNum="1"')
  expect(result).toContain('CTWS003')
  expect(result).toContain('Missing Ear Tag')
})

test('handle rejects a row for a dam with excessive recent calvings as CTWS209 once results are ready', () => {
  // Arrange
  const receiptNum = birthStore.submit({
    txnId: 'txn-1',
    rows: [excessiveCalvingRow]
  })
  vi.advanceTimersByTime(5000)
  const innerXml = buildInnerXml({ receiptNum })

  // Act
  const result = handle(innerXml)

  // Assert
  expect(result).toContain('CTWS209')
  expect(result).toContain('Multiple calvings have occurred')
})

test('handle throws a CTWS806 DomainError while the store has not yet validated the submission', () => {
  // Arrange
  const receiptNum = birthStore.submit({ txnId: 'txn-1', rows: [acceptedRow] })
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
  const receiptNum = birthStore.submit({ txnId: 'txn-1', rows: [] })
  vi.advanceTimersByTime(5000)
  const innerXml = buildInnerXml({ receiptNum, password: 'wrong' })
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
