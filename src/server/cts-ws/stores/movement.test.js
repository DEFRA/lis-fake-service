import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { movementStore } from './movement.js'

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

describe('movementStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test('movementStore validates an accepted row and reports it once results are ready', () => {
    // Arrange
    const receiptNum = movementStore.submit({
      txnId: 'txn-1',
      rows: [acceptedRow]
    })

    // Act
    vi.advanceTimersByTime(5000)
    const result = movementStore.retrieveResults(receiptNum)

    // Assert
    expect(result).toEqual({
      ready: true,
      results: { txnId: 'txn-1', accepted: [1], rejected: [] }
    })
  })

  test('movementStore validates a rejected row and reports its causes once results are ready', () => {
    // Arrange
    const receiptNum = movementStore.submit({
      txnId: 'txn-1',
      rows: [rejectedRow]
    })

    // Act
    vi.advanceTimersByTime(5000)
    const result = movementStore.retrieveResults(receiptNum)

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
              {
                code: 'CTWS307',
                desc: 'Ear Tag Not Found',
                sev: 'e',
                field: 'Etg'
              }
            ]
          }
        ]
      }
    })
  })

  test('movementStore reports not ready before the submission has been validated', () => {
    // Arrange
    const receiptNum = movementStore.submit({
      txnId: 'txn-1',
      rows: [acceptedRow]
    })

    // Act
    const result = movementStore.retrieveResults(receiptNum)

    // Assert
    expect(result).toEqual({ ready: false })
  })
})
