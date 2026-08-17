const XML_DECLARATION = '<?xml version="1.0" encoding="utf-8"?>'

/**
 * Base64-encodes an XML fragment the way the real SubPayLoadHelper does:
 * an XML declaration prepended, then the fragment, as a single UTF-8 payload.
 *
 * @param {string} xmlFragment
 * @returns {string}
 */
export function encodeDataPayload(xmlFragment) {
  return Buffer.from(`${XML_DECLARATION}${xmlFragment}`, 'utf-8').toString(
    'base64'
  )
}

/**
 * @param {string} base64Payload
 * @returns {string}
 */
export function decodeDataPayload(base64Payload) {
  return Buffer.from(base64Payload, 'base64').toString('utf-8')
}
