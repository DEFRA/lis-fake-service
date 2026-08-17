import { XMLParser } from 'fast-xml-parser'

import { extractXmlAttributes } from './extract-xml-attributes.js'
import { parseCtsOlUser } from './parse-cts-ol-user.js'

const MOV_ATTRIBUTE_NAMES = [
  'RowNum',
  'Etg',
  'EId',
  'Loc',
  'SLoc',
  'MDate',
  'MType',
  'RefNum',
  'IWarn'
]

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'Mov'
})

/**
 * @param {string} innerXml
 * @returns {{username: string, password: string, txnId: string, rows: {rowNum: number, attributes: Record<string, string>}[]}}
 */
export function parseRegisterMovementsRequest(innerXml) {
  const parsed = xmlParser.parse(innerXml)
  const regMovs = parsed.RegMovs

  if (!regMovs) {
    throw new Error('Decoded data payload is not a RegMovs request')
  }

  const rows = (regMovs.Moves?.Mov ?? []).map((mov) => ({
    rowNum: Number(mov['@_RowNum']),
    attributes: extractXmlAttributes(mov, MOV_ATTRIBUTE_NAMES)
  }))

  return {
    ...parseCtsOlUser(regMovs.Authentication),
    txnId: regMovs.Moves?.['@_TxnId'],
    rows
  }
}
