/** @import { Server } from '@hapi/hapi' */

import { statusCodes } from '../common/constants/status-codes.js'

export const health = {
  plugin: {
    name: 'health',
    /**
     * Registers the health route.
     * @param {Server} server - the Hapi server the plugin is registered on
     */
    register(server) {
      server.route({
        method: 'GET',
        path: '/health',
        options: { auth: false },
        handler(_request, h) {
          return h.response({ message: 'success' }).code(statusCodes.ok)
        }
      })
    }
  }
}
