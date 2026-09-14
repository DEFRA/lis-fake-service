import holdings from './krds-holdings.json' with { type: 'json' }

/**
 * @param {string} county
 * @param {string} parish
 * @param {string} holding
 * @returns {object | undefined} the HoldingDetail body, or undefined
 */
export function findHolding(county, parish, holding) {
  const record = holdings.find(
    (h) => h.county === county && h.parish === parish && h.holding === holding
  )

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
