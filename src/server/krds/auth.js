import { createBasicAuthPlugin } from '../common/auth/basic-auth.js'

const STRATEGY_NAME = 'krds'

// A Hapi auth provider: routes opt in with `options: { auth: 'krds' }` rather
// than each wiring up the header check themselves.
export const krdsAuth = createBasicAuthPlugin({
  strategyName: STRATEGY_NAME,
  clientIdConfigKey: 'krds.clientId',
  clientSecretConfigKey: 'krds.clientSecret'
})

export const AUTH_STRATEGY = STRATEGY_NAME
