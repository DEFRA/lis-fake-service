import { XMLParser } from 'fast-xml-parser'

import { extractXmlAttributes } from './extract-xml-attributes.js'
import { parseCtsOlUser } from './parse-cts-ol-user.js'

const BIRTH_ATTRIBUTE_NAMES = [
  'RowNum',
  'Etg',
  'Dob',
  'Brd',
  'Sex',
  'EId',
  'GdEtg',
  'SuEtg',
  'SiEtg',
  'BLoc',
  'BSLoc',
  'PLoc',
  'PSLoc',
  'IWarn'
]

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'Birth'
})

/**
 * @param {string} innerXml
 * @returns {{username: string, password: string, txnId: string, rows: {rowNum: number, attributes: Record<string, string>}[]}}
 */
export function parseRegisterBirthsRequest(innerXml) {
  const parsed = xmlParser.parse(innerXml)
  const regBirths = parsed.RegBirths

  if (!regBirths) {
    throw new Error('Decoded data payload is not a RegBirths request')
  }

  const rows = (regBirths.Births?.Birth ?? []).map((birth) => ({
    rowNum: Number(birth['@_RowNum']),
    attributes: extractXmlAttributes(birth, BIRTH_ATTRIBUTE_NAMES)
  }))

  return {
    ...parseCtsOlUser(regBirths.Authentication),
    txnId: regBirths.Births?.['@_TxnId'],
    rows
  }
}
