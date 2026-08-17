import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const fixturePath = path.resolve(
  dirname,
  '../../../../../data/fixtures/cts-movement-submissions.json'
)

// Keyed by TxnId, then RowNum, for every row of the batch - matching the
// real protocol's own response shape (`<Results TxnId="..."><Rejected>
// <Reject><Mov RowNum="..."/>`). Rejected rows carry their causes; rows
// that were accepted carry an empty array. A TxnId not present here (or a
// RowNum not listed under a known TxnId) is treated as accepted - this
// replays known real proving scenarios rather than generically validating
// arbitrary submitted content.
const submissionsByTxnId = JSON.parse(readFileSync(fixturePath, 'utf-8'))

/**
 * @param {string} txnId
 * @param {number} rowNum
 * @returns {{code: string, desc: string, sev: string, field: string}[] | undefined}
 */
export function findMovementRejections(txnId, rowNum) {
  return submissionsByTxnId[txnId]?.[String(rowNum)]
}
