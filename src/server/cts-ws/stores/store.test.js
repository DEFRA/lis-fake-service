import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { Store } from './store.js'

const rejectsFoo = {
  code: 'X001',
  desc: 'Foo is bad',
  sev: 'e',
  field: 'Foo',
  validate: (row) => row.Foo === 'bad'
}

const acceptedRow = { rowNum: 1, attributes: { Foo: 'good' } }
const rejectedRow = { rowNum: 1, attributes: { Foo: 'bad' } }

describe('Store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test('submit returns an incrementing receipt number for each submission', () => {
    // Arrange
    const store = new Store([rejectsFoo], 5)

    // Act
    const firstReceiptNum = store.submit({ txnId: 'txn-1', rows: [] })
    const secondReceiptNum = store.submit({ txnId: 'txn-2', rows: [] })

    // Assert
    expect(firstReceiptNum).toBe(1)
    expect(secondReceiptNum).toBe(2)
  })

  test('retrieveResults returns undefined for an unknown receipt number', () => {
    // Arrange
    const store = new Store([rejectsFoo], 5)

    // Act
    const result = store.retrieveResults(999)

    // Assert
    expect(result).toBeUndefined()
  })

  test('retrieveResults reports not ready before the random delay has elapsed', () => {
    // Arrange
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const store = new Store([rejectsFoo], 10)
    const receiptNum = store.submit({ txnId: 'txn-1', rows: [acceptedRow] })

    // Act
    const result = store.retrieveResults(receiptNum)

    // Assert
    expect(result).toEqual({ ready: false })
  })

  test('retrieveResults accepts a row whose content matches no cause once the delay has elapsed', () => {
    // Arrange
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const store = new Store([rejectsFoo], 10)
    const receiptNum = store.submit({ txnId: 'txn-1', rows: [acceptedRow] })

    // Act
    vi.advanceTimersByTime(5000)
    const result = store.retrieveResults(receiptNum)

    // Assert
    expect(result).toEqual({
      ready: true,
      results: { txnId: 'txn-1', accepted: [1], rejected: [] }
    })
  })

  test('retrieveResults rejects a row whose content matches a cause once the delay has elapsed', () => {
    // Arrange
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const store = new Store([rejectsFoo], 10)
    const receiptNum = store.submit({ txnId: 'txn-1', rows: [rejectedRow] })

    // Act
    vi.advanceTimersByTime(5000)
    const result = store.retrieveResults(receiptNum)

    // Assert
    expect(result).toEqual({
      ready: true,
      results: {
        txnId: 'txn-1',
        accepted: [],
        rejected: [
          {
            attributes: rejectedRow.attributes,
            causes: [
              { code: 'X001', desc: 'Foo is bad', sev: 'e', field: 'Foo' }
            ]
          }
        ]
      }
    })
  })

  test('hasSubmission returns false for a TxnId that has not been submitted by that user', () => {
    // Arrange
    const store = new Store([rejectsFoo], 5)

    // Act
    const result = store.hasSubmission('user-1', 'txn-1')

    // Assert
    expect(result).toBe(false)
  })

  test('hasSubmission returns true once that user has submitted that TxnId', () => {
    // Arrange
    const store = new Store([rejectsFoo], 5)
    store.submit({ username: 'user-1', txnId: 'txn-1', rows: [] })

    // Act
    const result = store.hasSubmission('user-1', 'txn-1')

    // Assert
    expect(result).toBe(true)
  })

  test('hasSubmission is scoped per user, not global', () => {
    // Arrange
    const store = new Store([rejectsFoo], 5)
    store.submit({ username: 'user-1', txnId: 'txn-1', rows: [] })

    // Act
    const result = store.hasSubmission('user-2', 'txn-1')

    // Assert
    expect(result).toBe(false)
  })

  test('submissions for different receipts are validated independently', () => {
    // Arrange
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const store = new Store([rejectsFoo], 10)

    // Act
    const firstReceiptNum = store.submit({
      txnId: 'txn-1',
      rows: [acceptedRow]
    })
    const secondReceiptNum = store.submit({
      txnId: 'txn-2',
      rows: [rejectedRow]
    })
    vi.advanceTimersByTime(0)

    // Assert
    expect(store.retrieveResults(firstReceiptNum)).toEqual({
      ready: true,
      results: { txnId: 'txn-1', accepted: [1], rejected: [] }
    })
    expect(store.retrieveResults(secondReceiptNum)).toEqual({
      ready: true,
      results: {
        txnId: 'txn-2',
        accepted: [],
        rejected: [
          {
            attributes: rejectedRow.attributes,
            causes: [
              { code: 'X001', desc: 'Foo is bad', sev: 'e', field: 'Foo' }
            ]
          }
        ]
      }
    })
  })
})
