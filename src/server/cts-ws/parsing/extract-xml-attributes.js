/**
 * Extracts a fixed, ordered set of attributes from a fast-xml-parser node
 * (attributeNamePrefix: '@_'), including only the ones actually present -
 * mirroring the real client's ShouldSerializeX pattern, where optional
 * blank fields are omitted from the XML entirely rather than sent empty.
 *
 * @param {object} node
 * @param {string[]} names
 * @returns {Record<string, string>}
 */
export function extractXmlAttributes(node, names) {
  const attributes = {}

  for (const name of names) {
    const value = node[`@_${name}`]
    if (value !== undefined) {
      attributes[name] = value
    }
  }

  return attributes
}
