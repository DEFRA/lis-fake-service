import { afterEach, expect, test, vi } from 'vitest'

const configValues = {
  'ctsWs.pendingPollsBeforeResults': 0
}

vi.mock('../../config/config.js', () => ({
  config: { get: (key) => configValues[key] }
}))

const { createReceipt, getReceiptBatch, takePendingPoll } =
  await import('./async-receipt-store.js')

afterEach(() => {
  configValues['ctsWs.pendingPollsBeforeResults'] = 0
})

test('createReceipt returns increasing receipt numbers', () => {
  // Arrange
  // Act
  const first = createReceipt('births', { rows: [] })
  const second = createReceipt('births', { rows: [] })

  // Assert
  expect(second).toBeGreaterThan(first)
})

test('getReceiptBatch returns the stored batch for a matching kind', () => {
  // Arrange
  const batch = { txnId: 'txn-1', rows: [{ rowNum: 1 }] }
  const receiptNum = createReceipt('births', batch)

  // Act
  const result = getReceiptBatch('births', receiptNum)

  // Assert
  expect(result).toBe(batch)
})

test('getReceiptBatch returns undefined for an unknown receipt number', () => {
  // Arrange
  // Act
  const result = getReceiptBatch('births', 999_999)

  // Assert
  expect(result).toBeUndefined()
})

test('getReceiptBatch returns undefined when the kind does not match', () => {
  // Arrange
  const receiptNum = createReceipt('births', { rows: [] })

  // Act
  const result = getReceiptBatch('movements', receiptNum)

  // Assert
  expect(result).toBeUndefined()
})

test('takePendingPoll returns false when no pending polls are configured', () => {
  // Arrange
  configValues['ctsWs.pendingPollsBeforeResults'] = 0
  const receiptNum = createReceipt('births', { rows: [] })

  // Act
  const result = takePendingPoll('births', receiptNum)

  // Assert
  expect(result).toBe(false)
})

test('takePendingPoll returns true until the configured pending-poll count is exhausted', () => {
  // Arrange
  configValues['ctsWs.pendingPollsBeforeResults'] = 2
  const receiptNum = createReceipt('births', { rows: [] })

  // Act
  const results = [
    takePendingPoll('births', receiptNum),
    takePendingPoll('births', receiptNum),
    takePendingPoll('births', receiptNum)
  ]

  // Assert
  expect(results).toEqual([true, true, false])
})

test('takePendingPoll returns false when the kind does not match', () => {
  // Arrange
  configValues['ctsWs.pendingPollsBeforeResults'] = 2
  const receiptNum = createReceipt('births', { rows: [] })

  // Act
  const result = takePendingPoll('movements', receiptNum)

  // Assert
  expect(result).toBe(false)
})

test('takePendingPoll returns false for an unknown receipt number', () => {
  // Arrange
  // Act
  const result = takePendingPoll('births', 999_999)

  // Assert
  expect(result).toBe(false)
})
