import { encodeDataPayload } from './soap-envelope.js'
import { xmlEnvironment } from './xml-environment.js'

/**
 * Wraps a result XML fragment (a MsgReceipt, BirthResults, MovResults,
 * SystemException, etc.) in the outer TransferDataHexResponse/SOAP
 * envelope every successful cts_ws response shares.
 *
 * @param {string} resultXmlFragment
 * @returns {string}
 */
export function buildTransferDataHexResponse(resultXmlFragment) {
  const bodyXml =
    '<TransferDataHexResponse xmlns="http://www.defra.gov.uk">' +
    `<TransferDataHexResult>${encodeDataPayload(resultXmlFragment)}</TransferDataHexResult>` +
    '</TransferDataHexResponse>'

  return xmlEnvironment.render('xml/templates/soap-envelope.njk', { bodyXml })
}
