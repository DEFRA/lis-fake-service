import { logger } from '../../common/helpers/logging/logger.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { config } from '../../../config/config.js'
import { DomainError } from './domain-error.js'
import { MalformedRequestError } from './malformed-request-error.js'
import { TransportFaultError } from './transport-fault-error.js'
import { buildTransferDataHexResponse } from '../xml/build-transfer-data-hex-response.js'
import { xmlEnvironment } from '../xml/xml-environment.js'

/** @import { Request, ResponseToolkit, ResponseObject } from '@hapi/hapi' */

/**
 * Maps the typed errors cts_ws route handlers throw onto their real wire
 * responses. Registered as a plugin-scoped extension (see index.js), so it
 * only applies to cts_ws's own routes, not the app's global error handling.
 * Any other error (a bug, not a modelled failure mode) still comes back as
 * a generic SOAP Fault rather than the app's default JSON error body -
 * per SOAP convention, and so a real client parsing the response as XML
 * doesn't choke on it.
 *
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @returns {ResponseObject | symbol}
 */
export function onPreResponse(request, h) {
  const response = request.response

  if (response instanceof DomainError) {
    const resultXml = xmlEnvironment.render(
      'xml/templates/system-exception.njk',
      {
        exNum: response.exNum,
        message: response.message
      }
    )

    return h
      .response(buildTransferDataHexResponse(resultXml))
      .type('text/xml')
      .code(statusCodes.ok)
  }

  if (response instanceof TransportFaultError) {
    const faultXml = xmlEnvironment.render('xml/templates/soap-fault.njk', {
      faultCode: response.faultCode,
      faultString: response.message
    })

    return h
      .response(faultXml)
      .type('text/xml')
      .code(statusCodes.internalServerError)
  }

  if (response instanceof MalformedRequestError) {
    return h.response().code(statusCodes.badRequest)
  }

  if ('isBoom' in response) {
    logger.error(response.stack)

    const faultXml = xmlEnvironment.render('xml/templates/soap-fault.njk', {
      faultCode: 'soap:Server',
      faultString: config.get('isProduction')
        ? 'Internal Server Error'
        : response.message
    })

    return h
      .response(faultXml)
      .type('text/xml')
      .code(statusCodes.internalServerError)
  }

  return h.continue
}
