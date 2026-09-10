import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Canonical animal test data: one file per animal in data/fixtures/animals/,
// a superset of what each fake needs. The cts-ws and cads fakes read this and
// map it into their own wire formats - it's the single source of truth so the
// two stay in step.

const dirname = path.dirname(fileURLToPath(import.meta.url))
const animalsDir = path.resolve(dirname, '../../../../data/fixtures/animals')

/**
 * @typedef {object} Animal
 * @property {string} earTag
 * @property {'Male' | 'Female'} sex
 * @property {string} breedCode
 * @property {string} birthDate
 * @property {string} currentCph
 * @property {string} registrationDate
 * @property {string} dateOnCph
 * @property {string | null} dateOffCph
 * @property {string | null} dateOfDeath
 * @property {string[]} calvingDates
 * @property {{ relationship: string, earTag: string }[]} parentage
 * @property {string} restrictionStatus
 */

/** @type {Animal[]} */
export const allAnimals = readdirSync(animalsDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => JSON.parse(readFileSync(path.join(animalsDir, file), 'utf-8')))

/** @type {Map<string, Animal>} */
export const animalsByEarTag = new Map(allAnimals.map((a) => [a.earTag, a]))
