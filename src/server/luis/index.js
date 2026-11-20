/** @import { Server } from '@hapi/hapi' */

import { post as postRequestToken } from './request-token/post.js'
import { get as getExport } from './export/get.js'
import { luisAuth } from './auth.js'
import { config } from '../../config/config.js'
import { logger } from '../common/helpers/logging/logger.js'

const CREDENTIAL_KEYS = ['luis.userId', 'luis.password', 'luis.tokenSecret']

export const luis = {
  plugin: {
    name: 'luis',
    /**
     * Registers the fake LUIS routes.
     * @param {Server} server - the Hapi server the plugin is registered on
     */
    async register(server) {
      if (CREDENTIAL_KEYS.some((key) => !config.get(key))) {
        logger.warn(
          'Fake LUIS issues no tokens: set LUIS_USER_ID, LUIS_PASSWORD and LUIS_TOKEN_SECRET'
        )
      }
      await server.register(luisAuth)
      server.route([postRequestToken, getExport])
    }
  }
}
