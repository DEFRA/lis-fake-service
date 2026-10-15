import { v5 as uuidv5 } from 'uuid'

import { config } from '../../../config/config.js'
import { loadFixtures } from './fixtures.js'

/** @import { HoldingAssociation, HoldingDetail, HoldingRole } from '../../krds/data/holdings.js' */

// Namespace for holding ids - each derived from the CPH so they're stable and
// not stored.
const HOLDING_NAMESPACE = uuidv5(
  'uk.gov.defra.lis.fake-service.holding',
  uuidv5.DNS
)

// Canonical holding test data: one file per CPH in data/fixtures/locations/
// (the people they reference are in data/fixtures/people/), each upserted
// from an optional env var (FAKE_LOCATIONS by CPH, FAKE_PEOPLE by customer
// number - see fixtures.js), a superset of what each fake needs. cts-ws
// reads the movement-suitability
// status / inactive date range / sub-location detail, the cads fake uses
// recognition, and the krds fake reads the full holding detail (including
// resolving a keeper's CPH to its holding id). It's the single source of
// truth so the fakes stay in step.

/**
 * @typedef {object} SubLocation
 * @property {string} status
 * @property {string} [inactiveFrom]
 * @property {string} [inactiveTo]
 */

/**
 * A location fixture: krds's HoldingDetail plus the movement-suitability
 * fields only cts-ws reads.
 *
 * @typedef {HoldingDetail & {
 *   status: string,
 *   inactiveFrom?: string,
 *   inactiveTo?: string,
 *   requiresSubLocation?: boolean,
 *   subLocations?: Record<string, SubLocation>
 * }} Location
 */

/**
 * Location fixtures reference people by customer number, so a person on
 * several holdings has one set of details (including one address)
 * everywhere they appear.
 *
 * @param {any} location - a location fixture as stored
 * @param {Map<string, Omit<HoldingAssociation, 'roles'>>} people - keyed by customer number
 * @returns {Location} the location with each association's person filled in
 */
export function withPeople(location, people) {
  return {
    ...location,
    associations: location.associations.map(
      (
        /** @type {{ customerNumber: string, roles: HoldingRole[] }} */ {
          customerNumber,
          roles
        }
      ) => {
        const person = people.get(customerNumber)
        if (!person) {
          throw new Error(
            `${location.identifier} references unknown person ${customerNumber}`
          )
        }
        return { ...person, roles }
      }
    )
  }
}

const peopleByCustomerNumber = loadFixtures({
  folder: 'people',
  envName: 'FAKE_PEOPLE',
  envValue: config.get('fixtures.people'),
  key: 'customerNumber'
})

/** @type {Map<string, Location>} */
const locations = new Map(
  [
    ...loadFixtures({
      folder: 'locations',
      envName: 'FAKE_LOCATIONS',
      envValue: config.get('fixtures.locations'),
      key: 'identifier'
    }).values()
  ].map((location) => [
    location.identifier,
    withPeople(location, peopleByCustomerNumber)
  ])
)

/**
 * @param {string} cph
 * @returns {Location | undefined} the location record, or undefined if the CPH
 *   isn't recognised
 */
export function findLocation(cph) {
  return locations.get(cph)
}

/**
 * @returns {Location[]} every location the fakes recognise
 */
export function allLocations() {
  return [...locations.values()]
}

/**
 * @param {string} email
 * @returns {{ cph: string, role: string }[]} every CPH/role pair this email
 *   is associated with, derived from each location's own associations - the
 *   single source of truth for a keeper's CPH assignments.
 */
export function cphsForEmail(email) {
  return [...locations.values()].flatMap((location) =>
    location.associations
      .filter((association) => association.email === email)
      .flatMap((association) =>
        association.roles.map((role) => ({
          cph: location.identifier,
          role: role.code
        }))
      )
  )
}

/**
 * @param {string} cph
 * @returns {boolean} whether the CPH is one the fakes recognise
 */
export function isKnownCph(cph) {
  return locations.has(cph)
}

/**
 * @param {string} cph
 * @returns {string | undefined} the holding's stable id, or undefined if the
 *   CPH isn't recognised
 */
export function holdingId(cph) {
  return isKnownCph(cph) ? uuidv5(cph, HOLDING_NAMESPACE) : undefined
}
