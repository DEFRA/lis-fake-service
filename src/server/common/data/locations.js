import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { v5 as uuidv5 } from 'uuid'

/** @import { HoldingDetail } from '../../krds/data/holdings.js' */

// Namespace for holding ids - each derived from the CPH so they're stable and
// not stored.
const HOLDING_NAMESPACE = uuidv5(
  'uk.gov.defra.lis.fake-service.holding',
  uuidv5.DNS
)

// Canonical holding test data: one file per CPH in data/fixtures/locations/,
// a superset of what each fake needs. cts-ws reads the movement-suitability
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

const dirname = path.dirname(fileURLToPath(import.meta.url))
const locationsDir = path.resolve(
  dirname,
  '../../../../data/fixtures/locations'
)

/** @type {Map<string, Location>} */
const locations = new Map(
  readdirSync(locationsDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const record = JSON.parse(
        readFileSync(path.join(locationsDir, file), 'utf-8')
      )
      return [record.identifier, record]
    })
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
