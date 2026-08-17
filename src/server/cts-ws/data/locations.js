import { hasAnimalOnHolding } from './animals.js'

// Sparse overrides for locations that deviate from the default (active,
// suitable for movements, no sub-location required) - cancelled, inactive-
// dated, unsuitable, or sub-location-requiring holdings. Any CPH with an
// animal on it (cts-animals.json) that isn't listed here is treated as a
// normal, active, suitable location with no sub-location requirement.
import overrides from '../../../../data/fixtures/cts-locations.json' with { type: 'json' }

const DEFAULT_LOCATION = { status: 'active' }

/**
 * @param {string} cph
 * @returns {object | undefined} the location record, or undefined if the
 *   CPH isn't recognised at all.
 */
export function findLocation(cph) {
  if (overrides[cph]) {
    return overrides[cph]
  }
  return hasAnimalOnHolding(cph) ? DEFAULT_LOCATION : undefined
}
