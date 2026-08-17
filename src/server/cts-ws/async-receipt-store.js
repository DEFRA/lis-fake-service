import { config } from '../../config/config.js'

let nextReceiptNum = 1
const receipts = new Map()

/**
 * Stores a submitted async batch (births or movements) and returns a fresh
 * receipt number for later polling via Get_Register_*_Validation_Results.
 *
 * @param {string} kind - 'births' or 'movements'
 * @param {object} batch
 * @returns {number}
 */
export function createReceipt(kind, batch) {
  const receiptNum = nextReceiptNum
  nextReceiptNum += 1
  receipts.set(receiptNum, {
    kind,
    batch,
    pendingPolls: config.get('ctsWs.pendingPollsBeforeResults') ?? 0
  })
  return receiptNum
}

/**
 * @param {string} kind - 'births' or 'movements'
 * @param {number} receiptNum
 * @returns {object | undefined} the stored batch, or undefined if the
 *   receipt doesn't exist or belongs to a different kind of submission.
 */
export function getReceiptBatch(kind, receiptNum) {
  const receipt = receipts.get(receiptNum)
  return receipt?.kind === kind ? receipt.batch : undefined
}

/**
 * Consumes one "still processing" poll for a receipt, simulating the real
 * CTWS806 backlog case real CTS clients (e.g. arachsys/cts-tool) retry on.
 * Decrements the receipt's remaining pending-poll count and returns true
 * while any remain; returns false (including for an unknown receipt) once
 * results should be considered ready.
 *
 * @param {string} kind - 'births' or 'movements'
 * @param {number} receiptNum
 * @returns {boolean}
 */
export function takePendingPoll(kind, receiptNum) {
  const receipt = receipts.get(receiptNum)

  if (receipt?.kind !== kind || receipt.pendingPolls <= 0) {
    return false
  }

  receipt.pendingPolls -= 1
  return true
}
