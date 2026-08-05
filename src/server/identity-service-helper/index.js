import { usersRoutes } from './users.js'
import { identityServiceHelperAuth } from './auth.js'

export const identityServiceHelper = {
  plugin: {
    name: 'identity-service-helper',
    async register(server) {
      await server.register(identityServiceHelperAuth)
      server.route(usersRoutes)
    }
  }
}
