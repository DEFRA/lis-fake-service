import crypto from 'node:crypto'

import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { DomainError } from './errors/domain-error.js'
import { TransportFaultError } from './errors/transport-fault-error.js'
import { operations } from './operations/index.js'
import { decodeDataPayload } from './xml/soap-envelope.js'
import { buildTransferDataHexResponse } from './xml/build-transfer-data-hex-response.js'

/** @import { Request, ResponseToolkit, ResponseObject } from '@hapi/hapi' */

const UNSUPPORTED_TYPE_EX_NUM = 'CTWS000'

// MD5 matches the real service's PasswordHelper - required for wire
// compatibility with this legacy protocol, not used as a security control.
function hashPassword(password) {
  // eslint-disable-next-line sonarjs/hashing
  return crypto.createHash('md5').update(password, 'ascii').digest('hex')
}

/**
 * Fakes the DefraDataTransferPublicNWSE.asmx TransferDataHex operation,
 * dispatching to the registered operation for the request's `type`. The
 * raw envelope is already parsed into `request.pre.transferDataHexRequest`
 * by the route's pre handler. Every remaining failure mode is a thrown,
 * typed error (TransportFaultError, DomainError) - the plugin's
 * onPreResponse extension maps each to its wire response, so this stays a
 * straight-line happy path.
 *
 * @param {Request} request
 * @param {ResponseToolkit} h
 * @returns {ResponseObject}
 */
export function transferDataHexHandler(request, h) {
  const transferDataHexRequest = request.pre.transferDataHexRequest

  if (
    transferDataHexRequest.username !== config.get('ctsWs.dthUsername') ||
    transferDataHexRequest.password !==
      hashPassword(config.get('ctsWs.dthPassword'))
  ) {
    throw new TransportFaultError('soap:Client', 'Authentication failed')
  }

  const operation = operations[transferDataHexRequest.type]

  if (!operation) {
    throw new DomainError(
      UNSUPPORTED_TYPE_EX_NUM,
      `Unsupported service type '${transferDataHexRequest.type}'`
    )
  }

  const resultXml = operation.handle(
    decodeDataPayload(transferDataHexRequest.data)
  )

  return h
    .response(buildTransferDataHexResponse(resultXml))
    .type('text/xml')
    .code(statusCodes.ok)
}
