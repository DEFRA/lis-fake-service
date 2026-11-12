/** @import { Server } from '@hapi/hapi' */

import { animalsRoutes } from './animals.js'
import { cadsAuth } from './auth.js'

export const cads = {
  plugin: {
    name: 'cads',
    /**
     * Registers the fake CADS routes.
     * @param {Server} server - the Hapi server the plugin is registered on
     */
    async register(server) {
      await server.register(cadsAuth)
      server.route(animalsRoutes)
    }
  }
}
