import { findLocation } from '../../common/data/locations.js'

/**
 * @param {string} county
 * @param {string} parish
 * @param {string} holding
 * @returns {object | undefined} the HoldingDetail body, or undefined if the
 *   CPH isn't recognised
 */
export function findHolding(county, parish, holding) {
  const record = findLocation(`${county}/${parish}/${holding}`)

  if (!record) {
    return undefined
  }

  return {
    identifier: record.identifier,
    holdingType: record.holdingType,
    name: record.name,
    startDate: record.startDate,
    endDate: record.endDate,
    location: record.location,
    associations: record.associations,
    allowedSpecies: record.allowedSpecies,
    marks: record.marks
  }
}
