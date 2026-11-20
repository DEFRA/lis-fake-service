/** @import { Server } from '@hapi/hapi' */

import { post as postRequestToken } from './request-token/post.js'
import { get as getExport } from './export/get.js'
import { luisAuth } from './auth.js'

export const luis = {
  plugin: {
    name: 'luis',
    /**
     * Registers the fake LUIS routes.
     * @param {Server} server - the Hapi server the plugin is registered on
     */
    async register(server) {
      await server.register(luisAuth)
      server.route([postRequestToken, getExport])
    }
  }
}
