import { animalsRoutes } from './animals.js'
import { cadsAuth } from './auth.js'

export const cads = {
  plugin: {
    name: 'cads',
    async register(server) {
      await server.register(cadsAuth)
      server.route(animalsRoutes)
    }
  }
}
