import { health } from './health/index.js'
import { identityServiceHelper } from './identity-service-helper/index.js'
import { ctsWs } from './cts-ws/index.js'
import { cads } from './cads/index.js'

export const router = {
  plugin: {
    name: 'router',
    async register(server) {
      await server.register([health, identityServiceHelper, ctsWs, cads])
    }
  }
}
