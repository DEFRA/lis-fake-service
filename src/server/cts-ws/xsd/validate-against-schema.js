import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import libxmljs from 'libxmljs2'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const schemasDir = path.resolve(dirname, 'schemas')

const schemaCache = new Map()

function loadSchema(schemaFileName) {
  if (!schemaCache.has(schemaFileName)) {
    const schemaPath = path.resolve(schemasDir, schemaFileName)
    const schemaXml = readFileSync(schemaPath, 'utf-8')
    schemaCache.set(
      schemaFileName,
      libxmljs.parseXml(schemaXml, { baseUrl: schemaPath })
    )
  }
  return schemaCache.get(schemaFileName)
}

/**
 * Validates an XML fragment against one of the real CTS request XSDs
 * (schemas/*.xsd, copied verbatim from the CTS POC evidence).
 *
 * @param {string} xml
 * @param {string} schemaFileName - e.g. 'register_births_request-V1-0.xsd'
 * @returns {{wellFormed: boolean, valid: boolean}} wellFormed is false for
 *   XML libxmljs2 can't even parse, in which case valid is also false and
 *   schema conformance was never checked - callers should let their normal
 *   malformed-XML handling take over rather than treat this as a schema
 *   violation.
 */
export function validateAgainstSchema(xml, schemaFileName) {
  let doc

  try {
    doc = libxmljs.parseXml(xml)
  } catch {
    return { wellFormed: false, valid: false }
  }

  const schema = loadSchema(schemaFileName)

  return { wellFormed: true, valid: doc.validate(schema) }
}
