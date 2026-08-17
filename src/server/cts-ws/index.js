import { transferDataHexHandler } from './controller.js'
import { onPreResponse } from './errors/on-pre-response.js'
import { parseTransferDataHexRequestPreHandler } from './parsing/parse-transfer-data-hex-request-pre-handler.js'

export const ctsWs = {
  plugin: {
    name: 'cts-ws',
    register(server) {
      server.ext('onPreResponse', onPreResponse)

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
