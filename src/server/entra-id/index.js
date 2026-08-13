import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../../config/config.js'
import { createOidcFakePlugin } from '../oidc-fake/create-oidc-fake-plugin.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export const entraId = createOidcFakePlugin({
  name: 'entra-id',
  label: 'Entra ID',
  mountPath: '/entra-id',
  fixturePath: path.resolve(dirname, '../../../data/fixtures/entra-id.json'),
  getExternalBase: () =>
    config.get('oidcFakes.entraId.externalBase') ??
    config.get('oidcFakes.entraId.internalBase'),
  getInternalBase: () => config.get('oidcFakes.entraId.internalBase')
})
