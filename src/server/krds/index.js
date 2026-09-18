import { holdingsRoutes } from './holdings.js'
import { cphAssociationsRoutes } from './cph-associations.js'
import { userAccountsRoutes } from './user-accounts.js'
import { krdsAuth } from './auth.js'

export const krds = {
  plugin: {
    name: 'krds',
    async register(server) {
      await server.register(krdsAuth)
      server.route(holdingsRoutes)
      server.route(cphAssociationsRoutes)
      server.route(userAccountsRoutes)
    }
  }
}
