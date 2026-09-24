import { health } from './health/index.js'
import { ctsWs } from './cts-ws/index.js'
import { cads } from './cads/index.js'
import { krds } from './krds/index.js'

export const router = {
  plugin: {
    name: 'router',
    async register(server) {
      await server.register([health, ctsWs, cads, krds])
    }
  }
}
