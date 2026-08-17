import path from 'node:path'
import { fileURLToPath } from 'node:url'

import nunjucks from 'nunjucks'

import { config } from '../../../config/config.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const ctsWsRoot = path.resolve(dirname, '..')

// A dedicated Nunjucks environment for cts_ws's XML fragments - kept
// separate from the app's HTML view engine (src/config/nunjucks/nunjucks.js)
// since these aren't HTTP view responses, just string rendering. Rooted at
// cts-ws/ (not xml/) so operation modules can render their own templates
// via a path like 'operations/get-register-births-validation-results.njk'.
export const xmlEnvironment = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(ctsWsRoot, {
    noCache: config.get('nunjucks.noCache')
  }),
  {
    autoescape: true,
    throwOnUndefined: true,
    trimBlocks: true,
    lstripBlocks: true
  }
)
