import { statusCodes } from '../../common/constants/status-codes.js'
import { AUTH_STRATEGY } from '../auth.js'
import { exportTags } from '../data/tags.js'

/** @import { Request, ResponseToolkit, ResponseObject } from '@hapi/hapi' */

/**
 * GET /luis/Hsa/{v}/Export
 * The ear tag orders for the export window.
 *
 * @param {Request} _request
 * @param {ResponseToolkit} h
 * @returns {ResponseObject}
 */
function exportHandler(_request, h) {
  const tags = exportTags()

  return h
    .response({ Tags: tags, Records: tags.length, Further: false })
    .code(statusCodes.ok)
}

export const get = {
  method: 'GET',
  path: '/luis/Hsa/{version}/Export',
  options: { auth: AUTH_STRATEGY },
  handler: exportHandler
}
