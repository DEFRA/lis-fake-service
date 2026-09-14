import { holdingsRoutes } from './holdings.js'
import { krdsAuth } from './auth.js'

export const krds = {
  plugin: {
    name: 'krds',
    async register(server) {
      await server.register(krdsAuth)
      server.route(holdingsRoutes)
    }
  }
}
