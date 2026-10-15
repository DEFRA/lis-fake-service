import { config } from '../../../config/config.js'
import { loadFixtures } from './fixtures.js'

// Canonical animal test data: one file per animal in data/fixtures/animals/,
// upserted by earTag from the optional FAKE_ANIMALS env var, a superset of
// what each fake needs. The cts-ws and cads fakes read this and map it into
// their own wire formats - it's the single source of truth so the two stay in
// step.

/**
 * @typedef {object} Animal
 * @property {string} earTag
 * @property {'Male' | 'Female' | 'Unknown'} sex
 * @property {string | null} breedCode
 * @property {string} birthDate
 * @property {string} currentCph
 * @property {string} [registeredCph] where the animal was registered; defaults to currentCph
 * @property {string | null} registrationDate
 * @property {string | null} dateOnCph
 * @property {string | null} dateOffCph
 * @property {string | null} dateOfDeath
 * @property {string} [deathCph] where the animal died
 * @property {string[]} calvingDates
 * @property {{ relationship: string, earTag: string }[]} parentage
 * @property {string} restrictionStatus
 * @property {string} [earStatus] CTS CP.EARSTATUS long description; defaults to 'Passport Produced'
 */

/** @type {Map<string, Animal>} */
export const animalsByEarTag = loadFixtures({
  folder: 'animals',
  envName: 'FAKE_ANIMALS',
  envValue: config.get('fixtures.animals'),
  key: 'earTag'
})

/** @type {Animal[]} */
export const allAnimals = [...animalsByEarTag.values()]
