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
const { birthStore } = await import('../../stores/birth.js')

function buildInnerXml({
  username = 'cts-ol-user',
  password = 'cts-ol-pass',
  txnId = 'txn-1'
} = {}) {
  return (
    '<RegBirths xmlns="http://defra.bcms.ctws/register_births_request" SchemaVersion="1.0" ProgramName="CTWSProg" ProgramVersion="1b" RequestTimeStamp="2026-01-01T00:00:00Z">' +
    `<Authentication><CTS_OL_User xmlns="" Usr="${username}" Pwd="${password}"/></Authentication>` +
    `<Births TxnId="${txnId}"><Birth RowNum="1" Etg="UK000000000001" Dob="2020-01-01" Brd="HF" Sex="f" GdEtg="UK000000000000" BLoc="01/001/0001" PLoc="01/001/0001" IWarn="n"/></Births>` +
    '</RegBirths>'
  )
}

test('type is Register_Births_Asynchronous-V1-0', () => {
  // Assert
  expect(type).toBe('Register_Births_Asynchronous-V1-0')
})

test('handle submits the batch to the birth store and returns a receipt', () => {
  // Arrange
  const innerXml = buildInnerXml({ txnId: 'txn-submit' })

  // Act
  const result = handle(innerXml)
  const receiptNumMatch = result.match(/Receipt Num="(\d+)"/)
  const receiptNum = Number(receiptNumMatch[1])

  // Assert
  expect(result).toContain('<MsgReceipt')
  const entry = birthStore.submissions.get(receiptNum)
  expect(entry.submission.txnId).toBe('txn-submit')
  expect(entry.submission.rows).toHaveLength(1)
})

test('handle throws a DomainError for invalid credentials', () => {
  // Arrange
  const innerXml = buildInnerXml({ username: 'wrong', txnId: 'txn-bad-creds' })
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

test('handle throws a CTWS808 DomainError for XML that does not conform to the register_births_request XSD', () => {
  // Arrange - an invalid (lowercase) breed code violates BreedCode_Type's pattern
  const innerXml = buildInnerXml({ txnId: 'txn-bad-schema' }).replace(
    'Brd="HF"',
    'Brd="not-a-code"'
  )
  let error

  // Act
  try {
    handle(innerXml)
  } catch (e) {
    error = e
  }

  // Assert
  expect(error).toBeInstanceOf(DomainError)
  expect(error?.exNum).toBe('CTWS808')
})

test('handle throws a CTWS807 DomainError when the same user resubmits the same TxnId', () => {
  // Arrange
  const firstXml = buildInnerXml({ txnId: 'txn-resubmit' })
  const secondXml = buildInnerXml({ txnId: 'txn-resubmit' })
  handle(firstXml)
  let error

  // Act
  try {
    handle(secondXml)
  } catch (e) {
    error = e
  }

  // Assert
  expect(error).toBeInstanceOf(DomainError)
  expect(error?.exNum).toBe('CTWS807')
})
