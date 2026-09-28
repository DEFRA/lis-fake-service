import { findLocation } from '../../common/data/locations.js'

// Shapes mirror keeper-data-api's OpenAPI (v2) schemas of the same name.

/**
 * @typedef {object} HoldingAddress
 * @property {string | null} udprn
 * @property {string | null} addressLine1
 * @property {string | null} addressLine2
 * @property {string | null} postTown
 * @property {string | null} locality
 * @property {string | null} postcode
 * @property {string | null} country
 */

/**
 * @typedef {object} HoldingLocation
 * @property {string | null} osMapReference
 * @property {number | string | null} easting
 * @property {number | string | null} northing
 * @property {HoldingAddress} address
 */

/**
 * @typedef {object} HoldingRole
 * @property {string} code
 * @property {string[]} species
 */

/**
 * @typedef {object} HoldingAssociation
 * @property {string} customerNumber
 * @property {string | null} title
 * @property {string | null} firstName
 * @property {string | null} lastName
 * @property {string | null} name
 * @property {string} partyType
 * @property {string | null} email
 * @property {string | null} mobile
 * @property {string | null} telephone
 * @property {HoldingRole[]} roles
 */

/**
 * @typedef {object} HoldingMark
 * @property {string} mark
 * @property {string | null} startDate
 * @property {string | null} endDate
 * @property {string[]} species
 */

/**
 * @typedef {object} HoldingDetail
 * @property {string} identifier
 * @property {string | null} holdingType
 * @property {string | null} name
 * @property {string | null} startDate
 * @property {string | null} endDate
 * @property {HoldingLocation} location
 * @property {HoldingAssociation[]} associations
 * @property {string[]} allowedSpecies
 * @property {HoldingMark[]} marks
 */

/**
 * @param {string} county
 * @param {string} parish
 * @param {string} holding
 * @returns {HoldingDetail | undefined} the HoldingDetail body, or undefined if the
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
