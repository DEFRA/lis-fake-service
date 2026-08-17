import { config } from '../../../config/config.js'
import { DomainError } from '../errors/domain-error.js'
import { parseRegisterMovementsRequest } from '../parsing/parse-register-movements-request.js'
import { movementStore } from '../stores/movement.js'
import { validateAgainstSchema } from '../xsd/validate-against-schema.js'
import { xmlEnvironment } from '../xml/xml-environment.js'

export const type = 'Register_Movements_Asynchronous-V1-0'

/**
 * Handles a decoded Register_Movements_Asynchronous payload: validates the
 * CTS_OL_User credentials, submits the batch to the movement store for
 * later polling, and returns a receipt. Throws a DomainError for any
 * business-level failure.
 *
 * @param {string} innerXml
 * @returns {string}
 */
export function handle(innerXml) {
  const schemaResult = validateAgainstSchema(
    innerXml,
    'register_movements_request-V1-0.xsd'
  )

  if (schemaResult.wellFormed && !schemaResult.valid) {
    throw new DomainError(
      'CTWS808',
      "Request rejected - 'data' XML does not conform to the 'data' XSD"
    )
  }

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

  if (movementStore.hasSubmission(payload.username, payload.txnId)) {
    // Neither the ExNum nor ExMsg text is confirmed by real evidence -
    // CTWS807 replays the Full Proving spec's documented "Request rejected
    // (submitted already)" Register_* response, TxnId being unique per user.
    throw new DomainError('CTWS807', 'Request rejected - already submitted')
  }

  const receiptNum = movementStore.submit({
    username: payload.username,
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
