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
    Dob: '2020-01-01',
    Brd: 'HF',
    Sex: 'f',
    GdEtg: 'UK000000000000',
    BLoc: '01/001/0001',
    PLoc: '01/001/0001',
    IWarn: 'n'
  }
}

// Matches row 1 of the real captured reg-failure evidence, replayed under
// its real TxnId in cts-birth-submissions.json.
const rejectedRow = {
  rowNum: 1,
  attributes: {
    RowNum: '1',
    Etg: '   ',
    Dob: '2004-03-09',
    Brd: 'HF',
    Sex: 'f',
    EId: '111222333',
    GdEtg: 'UKAA2233 00009',
    SuEtg: 'UK560002400063',
    SiEtg: 'UK A1213 00003',
    BLoc: '20/002/0001',
    PLoc: '01/001/0001',
    PSLoc: '04',
    IWarn: 'n'
  }
}

// The reg-success evidence's TxnId - despite the name, real CTS actually
// rejects 7 of its 23 rows (accumulated real server-side history, not pure
// validation of the row content), so this batch exercises both outcomes
// under the same TxnId.
const REG_SUCCESS_TXN_ID = 'a58fceed3f084d7080d7e38b1b90357a'

// Row 1 of reg-success - genuinely accepted.
const regSuccessAcceptedRow = {
  rowNum: 1,
  attributes: {
    RowNum: '1',
    Etg: 'UK590066101017',
    Dob: '2004-03-09',
    Brd: 'HF',
    Sex: 'f',
    EId: '111222333',
    GdEtg: 'UKAA2233 00009',
    SuEtg: 'UK560002400063',
    SiEtg: 'UK A1213 00003',
    BLoc: '20/002/0001',
    PLoc: '21/021/0021',
    IWarn: 'y'
  }
}

// Row 3 of reg-success - one of the 7 real rejections in this "success" batch.
const regSuccessRejectedRow = {
  rowNum: 3,
  attributes: {
    RowNum: '3',
    Etg: 'UK520202500138',
    Dob: '2004-03-01',
    Brd: 'HF',
    Sex: 'f',
    EId: '111222333',
    GdEtg: 'UK560002400063',
    BLoc: '20/002/0001',
    PLoc: '01/001/0001',
    PSLoc: '04',
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

test('type is Get_Register_Births_Validation_Results-V1-0', () => {
  // Assert
  expect(type).toBe('Get_Register_Births_Validation_Results-V1-0')
})

test('handle accepts a row under an unrecognised TxnId', () => {
  // Arrange
  const receiptNum = createReceipt('births', {
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
  const receiptNum = createReceipt('births', {
    txnId: 'f6a3e7846dcb4d9bbf31f0957960cbe8',
    rows: [rejectedRow]
  })
  const innerXml = buildInnerXml({ receiptNum })

  // Act
  const result = handle(innerXml)

  // Assert
  expect(result).toContain('RowNum="1"')
  expect(result).toContain('CTWS003')
  expect(result).toContain('Missing Ear Tag')
})

test('handle replays the real mixed accept/reject outcome for the reg-success evidence TxnId', () => {
  // Arrange
  const receiptNum = createReceipt('births', {
    txnId: REG_SUCCESS_TXN_ID,
    rows: [regSuccessAcceptedRow, regSuccessRejectedRow]
  })
  const innerXml = buildInnerXml({ receiptNum })

  // Act
  const result = handle(innerXml)

  // Assert
  expect(result).toContain('<Accept RowNum="1"/>')
  expect(result).toContain('RowNum="3"')
  expect(result).toContain('CTWS209')
  expect(result).toContain('Multiple calvings have occurred')
})

test('handle throws a DomainError for invalid credentials', () => {
  // Arrange
  const receiptNum = createReceipt('births', {
    txnId: 'unrecognised-txn',
    rows: []
  })
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

test('handle throws a CTWS806 DomainError while pending polls remain, then classifies rows once exhausted', () => {
  // Arrange
  configValues['ctsWs.pendingPollsBeforeResults'] = 1
  const receiptNum = createReceipt('births', {
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
