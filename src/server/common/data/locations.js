import { v5 as uuidv5 } from 'uuid'
import locations from '../../../../data/fixtures/locations.json' with { type: 'json' }

// Namespace for holding ids - each derived from the CPH so they're stable and
// not stored.
const HOLDING_NAMESPACE = uuidv5(
  'uk.gov.defra.lis.fake-service.holding',
  uuidv5.DNS
)

// The holding registry, keyed by CPH: every CPH the fakes recognise, with its
// movement-suitability status and (where relevant) inactive date range or
// sub-location structure. Each holding's stable id is derived from its CPH
// rather than stored. Shared: cts-ws movement validation reads the status /
// sub-location detail, the cads fake uses recognition, and the
// identity-service-helper fake resolves a keeper's CPH to its holding id.

/**
 * @param {string} cph
 * @returns {object | undefined} the location record, or undefined if the CPH
 *   isn't recognised
 */
export function findLocation(cph) {
  return locations[cph]
}

/**
 * @param {string} cph
 * @returns {boolean} whether the CPH is one the fakes recognise
 */
export function isKnownCph(cph) {
  return Object.hasOwn(locations, cph)
}

/**
 * @param {string} cph
 * @returns {string | undefined} the holding's stable id, or undefined if the
 *   CPH isn't recognised
 */
export function holdingId(cph) {
  return isKnownCph(cph) ? uuidv5(cph, HOLDING_NAMESPACE) : undefined
}
