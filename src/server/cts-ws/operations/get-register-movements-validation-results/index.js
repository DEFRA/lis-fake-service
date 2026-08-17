import { config } from '../../../../config/config.js'
import { getReceiptBatch, takePendingPoll } from '../../async-receipt-store.js'
import { DomainError } from '../../errors/domain-error.js'
import { parseGetResultsRequest } from '../../parsing/parse-get-results-request.js'
import { xmlEnvironment } from '../../xml/xml-environment.js'
import { findMovementRejections } from './movement-submissions-fixture.js'

export const type = 'Get_Register_Movements_Validation_Results-V1-0'

/**
 * Handles a decoded Get_Register_Movements_Validation_Results payload:
 * validates the CTS_OL_User credentials, looks up the receipt, and
 * classifies each submitted row as accepted or rejected against the
 * movement-submissions fixture, keyed by the batch's TxnId and each row's
 * RowNum - matching the real response's own `<Results TxnId="..."><Reject>
 * <Mov RowNum="..."/>` shape. A row with no matching fixture entry (an
 * unrecognised TxnId, or a RowNum not listed under a known one) is treated
 * as accepted.
 *
 * @param {string} innerXml
 * @returns {string}
 */
export function handle(innerXml) {
  let payload

  try {
    payload = parseGetResultsRequest(innerXml)
  } catch {
    throw new DomainError(
      'CTWS000',
      'Malformed Get_Register_Movements_Validation_Results payload'
    )
  }

  if (
    payload.username !== config.get('ctsWs.ctsOlUsername') ||
    payload.password !== config.get('ctsWs.ctsOlPassword')
  ) {
    throw new DomainError('CTWS001', 'Authentication failed')
  }

  const batch = getReceiptBatch('movements', payload.receiptNum)

  if (!batch) {
    throw new DomainError(
      'CTWS002',
      `Receipt '${payload.receiptNum}' not found`
    )
  }

  if (takePendingPoll('movements', payload.receiptNum)) {
    // Real ExMsg text unverified - only the ExNum is confirmed, via
    // arachsys/cts-tool's retry loop on this code.
    throw new DomainError('CTWS806', 'Results not yet available')
  }

  const accepted = []
  const rejected = []

  for (const row of batch.rows) {
    const causes = findMovementRejections(batch.txnId, row.rowNum)

    if (causes?.length) {
      rejected.push({ attributes: row.attributes, causes })
    } else {
      accepted.push(row.rowNum)
    }
  }

  return xmlEnvironment.render(
    'operations/get-register-movements-validation-results/movement-results.njk',
    {
      schemaVersion: '1.0',
      programName: 'CTS Webservices',
      programVersion: '1h',
      responseTimeStamp: new Date().toISOString(),
      txnId: batch.txnId,
      accepted,
      rejected
    }
  )
}
