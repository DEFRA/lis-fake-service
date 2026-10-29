import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateXML } from 'xmllint-wasm'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const schemasDir = path.resolve(dirname, 'schemas')

// Shared type definitions that the request schemas pull in with <xs:include>.
// xmllint-wasm does no IO of its own, so every included file has to be handed
// to it up front.
const SHARED_TYPES_SCHEMA = 'ctws_types-V1-0.xsd'

const schemaCache = new Map()

function loadSchema(schemaFileName) {
  if (!schemaCache.has(schemaFileName)) {
    schemaCache.set(schemaFileName, {
      fileName: schemaFileName,
      contents: readFileSync(path.resolve(schemasDir, schemaFileName), 'utf-8')
    })
  }
  return schemaCache.get(schemaFileName)
}

/**
 * Validates an XML fragment against one of the real CTS request XSDs
 * (schemas/*.xsd, copied verbatim from the CTS POC evidence).
 *
 * @param {string} xml
 * @param {string} schemaFileName - e.g. 'register_births_request-V1-0.xsd'
 * @returns {Promise<{wellFormed: boolean, valid: boolean}>} wellFormed is
 *   false for XML libxml2 can't even parse, in which case valid is also false
 *   and schema conformance was never checked - callers should let their normal
 *   malformed-XML handling take over rather than treat this as a schema
 *   violation.
 */
export async function validateAgainstSchema(xml, schemaFileName) {
  const result = await validateXML({
    xml: [{ fileName: 'request.xml', contents: xml }],
    schema: [loadSchema(schemaFileName)],
    preload: [loadSchema(SHARED_TYPES_SCHEMA)]
  })

  if (result.valid) {
    return { wellFormed: true, valid: true }
  }

  const wellFormed = !result.errors.some((error) =>
    error.message.includes('parser error')
  )

  return { wellFormed, valid: false }
}
