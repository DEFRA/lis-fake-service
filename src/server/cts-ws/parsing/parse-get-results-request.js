import { XMLParser } from 'fast-xml-parser'

import { parseCtsOlUser } from './parse-cts-ol-user.js'

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
})

/**
 * Parses a decoded GetResults payload - the shared shape used to poll for
 * both births and movements validation results.
 *
 * @param {string} innerXml
 * @returns {{username: string, password: string, receiptNum: number}}
 */
export function parseGetResultsRequest(innerXml) {
  const parsed = xmlParser.parse(innerXml)
  const getResults = parsed.GetResults

  if (!getResults) {
    throw new Error('Decoded data payload is not a GetResults request')
  }

  return {
    ...parseCtsOlUser(getResults.Authentication),
    receiptNum: Number(getResults.Receipt?.['@_Num'])
  }
}
