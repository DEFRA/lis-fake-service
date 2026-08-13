import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../../config/config.js'
import { createOidcFakePlugin } from '../oidc-fake/create-oidc-fake-plugin.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export const defraCi = createOidcFakePlugin({
  name: 'defra-ci',
  label: 'DEFRA CI',
  mountPath: '/defra-ci',
  fixturePath: path.resolve(dirname, '../../../data/fixtures/defra-ci.json'),
  getExternalBase: () =>
    config.get('oidcFakes.defraCi.externalBase') ??
    config.get('oidcFakes.defraCi.internalBase'),
  getInternalBase: () => config.get('oidcFakes.defraCi.internalBase')
})
