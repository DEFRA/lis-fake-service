import { XMLParser } from 'fast-xml-parser'

import { MalformedRequestError } from '../errors/malformed-request-error.js'

/** @import { Request } from '@hapi/hapi' */

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
})

/**
 * Route `pre` handler: parses the raw TransferDataHex SOAP request body,
 * making the result available to the main handler as
 * `request.pre.transferDataHexRequest`. Throws a MalformedRequestError for
 * anything that isn't a valid envelope, short-circuiting straight to
 * onPreResponse without running the main handler.
 *
 * @param {Request} request
 * @returns {{username: string, password: string, serviceName: string, data: string, type: string}}
 */
export function parseTransferDataHexRequestPreHandler(request) {
  let transferDataHex

  try {
    const parsed = xmlParser.parse(request.payload.toString('utf-8'))
    transferDataHex = parsed['soap:Envelope']?.['soap:Body']?.TransferDataHex
  } catch {
    // fast-xml-parser throws on badly-formed XML - fall through to the
    // MalformedRequestError below along with the "well-formed but not a
    // TransferDataHex envelope" case.
  }

  if (!transferDataHex) {
    throw new MalformedRequestError(
      'Request body is not a valid TransferDataHex SOAP envelope'
    )
  }

  return {
    username: transferDataHex.username,
    password: transferDataHex.password,
    serviceName: transferDataHex.serviceName,
    data: transferDataHex.data,
    type: transferDataHex.type
  }
}
