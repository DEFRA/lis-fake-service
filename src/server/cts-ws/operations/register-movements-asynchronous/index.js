import { config } from '../../../../config/config.js'
import { createReceipt } from '../../async-receipt-store.js'
import { DomainError } from '../../errors/domain-error.js'
import { xmlEnvironment } from '../../xml/xml-environment.js'
import { parseRegisterMovementsRequest } from './parse-register-movements-request.js'

export const type = 'Register_Movements_Asynchronous-V1-0'

/**
 * Handles a decoded Register_Movements_Asynchronous payload: validates the
 * CTS_OL_User credentials, stores the batch for later polling, and returns
 * a receipt. Throws a DomainError for any business-level failure.
 *
 * @param {string} innerXml
 * @returns {string}
 */
export function handle(innerXml) {
  let payload

  try {
    payload = parseRegisterMovementsRequest(innerXml)
  } catch {
    throw new DomainError(
      'CTWS000',
      'Malformed Register_Movements_Asynchronous payload'
    )
  }

  if (
    payload.username !== config.get('ctsWs.ctsOlUsername') ||
    payload.password !== config.get('ctsWs.ctsOlPassword')
  ) {
    throw new DomainError('CTWS001', 'Authentication failed')
  }

  const receiptNum = createReceipt('movements', {
    txnId: payload.txnId,
    rows: payload.rows
  })

  return xmlEnvironment.render('xml/templates/msg-receipt.njk', {
    schemaVersion: '1.0',
    programName: 'CTS Webservices',
    programVersion: '1h',
    responseTimeStamp: new Date().toISOString(),
    receiptNum
  })
}
