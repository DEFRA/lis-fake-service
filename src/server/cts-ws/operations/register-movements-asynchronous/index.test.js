import { expect, test, vi } from 'vitest'

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
const { getReceiptBatch } = await import('../../async-receipt-store.js')

function buildInnerXml({
  username = 'cts-ol-user',
  password = 'cts-ol-pass'
} = {}) {
  return (
    '<RegMovs xmlns="http://defra.bcms.ctws/register_movements_request" SchemaVersion="1.0" ProgramName="CTWSProg" ProgramVersion="1b" RequestTimeStamp="2026-01-01T00:00:00Z">' +
    `<Authentication><CTS_OL_User Usr="${username}" Pwd="${password}"/></Authentication>` +
    '<Moves TxnId="txn-1"><Mov RowNum="1" Etg="UK1" Loc="01/001/0001" SLoc="04" MDate="2020-01-01" MType="on" RefNum="1" IWarn="n"/></Moves>' +
    '</RegMovs>'
  )
}

test('type is Register_Movements_Asynchronous-V1-0', () => {
  // Assert
  expect(type).toBe('Register_Movements_Asynchronous-V1-0')
})

test('handle stores the batch and returns a receipt', () => {
  // Arrange
  const innerXml = buildInnerXml()

  // Act
  const result = handle(innerXml)
  const receiptNumMatch = result.match(/Receipt Num="(\d+)"/)
  const receiptNum = Number(receiptNumMatch[1])

  // Assert
  expect(result).toContain('<MsgReceipt')
  const batch = getReceiptBatch('movements', receiptNum)
  expect(batch.txnId).toBe('txn-1')
  expect(batch.rows).toHaveLength(1)
})

test('handle throws a DomainError for invalid credentials', () => {
  // Arrange
  const innerXml = buildInnerXml({ password: 'wrong' })
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
