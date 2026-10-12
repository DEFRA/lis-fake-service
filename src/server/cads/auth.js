import { createBasicAuthPlugin } from '../common/auth/basic-auth.js'
import { unauthorized } from './helpers/problems.js'

const STRATEGY_NAME = 'cads'

// A Hapi auth provider: routes opt in with `options: { auth: 'cads' }` rather
// than each wiring up the header check themselves.
export const cadsAuth = createBasicAuthPlugin({
  strategyName: STRATEGY_NAME,
  clientIdConfigKey: 'cads.clientId',
  clientSecretConfigKey: 'cads.clientSecret',
  unauthorizedResponse: unauthorized
})

export const AUTH_STRATEGY = STRATEGY_NAME
