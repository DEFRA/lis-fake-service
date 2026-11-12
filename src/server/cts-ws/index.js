/** @import { Server } from '@hapi/hapi' */

import { transferDataHexHandler } from './controller.js'
import { onPreResponse } from './errors/on-pre-response.js'
import { parseTransferDataHexRequestPreHandler } from './parsing/parse-transfer-data-hex-request-pre-handler.js'

export const ctsWs = {
  plugin: {
    name: 'cts-ws',
    /**
     * Registers the fake CTS web service routes.
     * @param {Server} server - the Hapi server the plugin is registered on
     */
    register(server) {
      server.ext('onPreResponse', onPreResponse, { sandbox: 'plugin' })

      server.route({
        method: 'POST',
        path: '/cts_ws/DefraDataTransferPublicNWSE.asmx',
        options: {
          auth: false,
          payload: { parse: false },
          pre: [
            {
              method: parseTransferDataHexRequestPreHandler,
              assign: 'transferDataHexRequest'
            }
          ]
        },
        handler: transferDataHexHandler
      })
    }
  }
}
