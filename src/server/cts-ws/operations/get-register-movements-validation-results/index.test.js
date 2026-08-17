import { afterEach, expect, test, vi } from 'vitest'

const configValues = {
  'ctsWs.ctsOlUsername': 'cts-ol-user',
  'ctsWs.ctsOlPassword': 'cts-ol-pass',
  'ctsWs.pendingPollsBeforeResults': 0,
  'nunjucks.noCache': true
}

vi.mock('../../../../config/config.js', () => ({
  config: { get: (key) => configValues[key] }
}))

const { handle, type } = await import('./index.js')
const { DomainError } = await import('../../errors/domain-error.js')
const { createReceipt } = await import('../../async-receipt-store.js')

const acceptedRow = {
  rowNum: 1,
  attributes: {
    RowNum: '1',
    Etg: 'UK000000000001',
    Loc: '01/001/0001',
    SLoc: '04',
    MDate: '2020-01-01',
    MType: 'on',
    RefNum: '1',
    IWarn: 'n'
  }
}

// Matches row 1 of the real captured move-failure evidence, replayed under
// its real TxnId in cts-movement-submissions.json.
const rejectedRow = {
  rowNum: 1,
  attributes: {
    RowNum: '1',
    Etg: 'UK590066500055',
    Loc: '01/001/0001',
    SLoc: '04',
    MDate: '2005-05-01',
    MType: 'off',
    RefNum: '1',
    IWarn: 'n'
  }
}

// The move-failure evidence's TxnId - all but one of its 13 rows are real
// rejections, including a CTWS336 duplicate pair (rows 12 and 13).
const MOVE_FAILURE_TXN_ID = 'e77266c3abd74b6e9793598842660b28'

// Row 12 of move-failure - genuinely accepted (first of the duplicate pair).
const duplicateFirstRow = {
  rowNum: 12,
  attributes: {
    RowNum: '12',
    Etg: 'UK590066300242',
    Loc: '01/001/0001',
    SLoc: '04',
    MDate: '2005-05-01',
    MType: 'off',
    RefNum: '1',
    IWarn: 'n'
  }
}

// Row 13 of move-failure - rejected as CTWS336 (second of the duplicate pair).
const duplicateSecondRow = {
  rowNum: 13,
  attributes: {
    RowNum: '13',
    Etg: 'UK590066300242',
    Loc: '01/001/0001',
    SLoc: '04',
    MDate: '2005-05-01',
    MType: 'off',
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

afterEach(() => {
  configValues['ctsWs.pendingPollsBeforeResults'] = 0
})

test('type is Get_Register_Movements_Validation_Results-V1-0', () => {
  // Assert
  expect(type).toBe('Get_Register_Movements_Validation_Results-V1-0')
})

test('handle accepts a row under an unrecognised TxnId', () => {
  // Arrange
  const receiptNum = createReceipt('movements', {
    txnId: 'unrecognised-txn',
    rows: [acceptedRow]
  })
  const innerXml = buildInnerXml({ receiptNum })

  // Act
  const result = handle(innerXml)

  // Assert
  expect(result).toContain('<Accept RowNum="1"/>')
  expect(result).not.toContain('<Rejected>')
})

test('handle rejects a row matching a real fixture entry with its cause', () => {
  // Arrange
  const receiptNum = createReceipt('movements', {
    txnId: MOVE_FAILURE_TXN_ID,
    rows: [rejectedRow]
  })
  const innerXml = buildInnerXml({ receiptNum })

  // Act
  const result = handle(innerXml)

  // Assert
  expect(result).toContain('RowNum="1"')
  expect(result).toContain('CTWS307')
  expect(result).toContain('Ear Tag Not Found')
})

test('handle replays the real mixed accept/reject outcome for the move-failure evidence TxnId', () => {
  // Arrange
  const receiptNum = createReceipt('movements', {
    txnId: MOVE_FAILURE_TXN_ID,
    rows: [duplicateFirstRow, duplicateSecondRow]
  })
  const innerXml = buildInnerXml({ receiptNum })

  // Act
  const result = handle(innerXml)

  // Assert
  expect(result).toContain('<Accept RowNum="12"/>')
  expect(result).toContain('RowNum="13"')
  expect(result).toContain('CTWS336')
  expect(result).toContain('Duplicate movement in file')
})

test('handle throws a CTWS806 DomainError while pending polls remain, then classifies rows once exhausted', () => {
  // Arrange
  configValues['ctsWs.pendingPollsBeforeResults'] = 1
  const receiptNum = createReceipt('movements', {
    txnId: 'unrecognised-txn',
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
  const result = handle(innerXml)

  // Assert
  expect(error).toBeInstanceOf(DomainError)
  expect(error?.exNum).toBe('CTWS806')
  expect(result).toContain('<Accept RowNum="1"/>')
})

test('handle throws a DomainError for invalid credentials', () => {
  // Arrange
  const receiptNum = createReceipt('movements', {
    txnId: 'unrecognised-txn',
    rows: []
  })
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

test('handle throws a DomainError when the receipt belongs to a births batch', () => {
  // Arrange
  const receiptNum = createReceipt('births', {
    txnId: 'unrecognised-txn',
    rows: []
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
  expect(error?.message).toContain('not found')
})
