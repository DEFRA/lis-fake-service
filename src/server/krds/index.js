/** @import { Server } from '@hapi/hapi' */

import { getMany as getHoldings } from './holdings/get-many.js'
import { getOne as getHolding } from './holdings/get-one.js'
import { getMany as getCphAssociations } from './cph-associations/get-many.js'
import { getOne as getUserAccount } from './user-accounts/get-one.js'
import { post as postUserAccount } from './user-accounts/post.js'
import { krdsAuth } from './auth.js'

export const krds = {
  plugin: {
    name: 'krds',
    /**
     * Registers the fake KRDS routes.
     * @param {Server} server - the Hapi server the plugin is registered on
     */
    async register(server) {
      await server.register(krdsAuth)
      server.route([
        getHoldings,
        getHolding,
        getCphAssociations,
        getUserAccount,
        postUserAccount
      ])
    }
  }
}
