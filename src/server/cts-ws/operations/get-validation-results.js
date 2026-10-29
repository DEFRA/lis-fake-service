import { config } from '../../../config/config.js'
import { DomainError } from '../errors/domain-error.js'
import { parseGetResultsRequest } from '../parsing/parse-get-results-request.js'
import { validateAgainstSchema } from '../xsd/validate-against-schema.js'
import { xmlEnvironment } from '../xml/xml-environment.js'

/**
 * Builds the handler for a Get_Register_*_Validation_Results operation: it
 * validates the CTS_OL_User credentials, then polls the given store for the
 * receipt's results - CTWS002 for an unknown receipt, CTWS806 while the
 * store's random validation delay hasn't elapsed yet, otherwise the store's
 * own accept/reject classification for the batch.
 *
 * @param {object} options
 * @param {string} options.type - the TransferDataHex `type` value
 * @param {{retrieveResults: (receiptNum: string) => {ready: boolean, results: {txnId: string, accepted: unknown, rejected: unknown}} | undefined}} options.store
 * @param {string} options.template - Nunjucks template for the response
 * @returns {(innerXml: string) => Promise<string>}
 */
export function createGetValidationResultsHandler({ type, store, template }) {
  return async function handle(innerXml) {
    const schemaResult = await validateAgainstSchema(
      innerXml,
      'get_asynchronous_results-V1-0.xsd'
    )

    if (schemaResult.wellFormed && !schemaResult.valid) {
      throw new DomainError(
        'CTWS808',
        "Request rejected - 'data' XML does not conform to the 'data' XSD"
      )
    }

    let payload

    try {
      payload = parseGetResultsRequest(innerXml)
    } catch {
      throw new DomainError('CTWS000', `Malformed ${type} payload`)
    }

    if (
      payload.username !== config.get('ctsWs.ctsOlUsername') ||
      payload.password !== config.get('ctsWs.ctsOlPassword')
    ) {
      throw new DomainError('CTWS001', 'Authentication failed')
    }

    const submission = store.retrieveResults(payload.receiptNum)

    if (!submission) {
      throw new DomainError(
        'CTWS002',
        `Receipt '${payload.receiptNum}' not found`
      )
    }

    if (!submission.ready) {
      // Real ExMsg text unverified - only the ExNum is confirmed, via
      // arachsys/cts-tool's retry loop on this code.
      throw new DomainError('CTWS806', 'Results not yet available')
    }

    return xmlEnvironment.render(template, {
      schemaVersion: '1.0',
      programName: 'CTS Webservices',
      programVersion: '1h',
      responseTimeStamp: new Date().toISOString(),
      txnId: submission.results.txnId,
      accepted: submission.results.accepted,
      rejected: submission.results.rejected
    })
  }
}
