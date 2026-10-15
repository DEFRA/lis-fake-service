import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { logger } from '../helpers/logging/logger.js'

// Fixture records come from data/fixtures/<folder>/*.json (baked into the
// image) and are then upserted from an optional env var holding a JSON array
// (raw or base64-encoded), so a deployed fake can gain or override records
// without a rebuild. A matching key replaces the whole file record.

const dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(dirname, '../../../../data/fixtures')

/**
 * @param {string} folder
 * @returns {any[]} every JSON fixture in data/fixtures/<folder>
 */
export function readFixtureDir(folder) {
  const dir = path.join(fixturesDir, folder)
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(path.join(dir, file), 'utf-8')))
}

/**
 * @param {string} name - the env var name, for error messages
 * @param {string | undefined} value - a JSON array, raw or base64-encoded
 * @returns {any[]} the records, or an empty array if the value is unset/blank
 */
export function parseFixtureEnv(name, value) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return []
  }

  const json = trimmed.startsWith('[')
    ? trimmed
    : Buffer.from(trimmed, 'base64').toString('utf-8')

  let records
  try {
    records = JSON.parse(json)
  } catch (error) {
    throw new Error(
      `${name} is not valid JSON (raw or base64): ${/** @type {Error} */ (error).message}`
    )
  }

  if (!Array.isArray(records)) {
    throw new Error(`${name} must be a JSON array of records`)
  }

  return records
}

/**
 * @param {object} options
 * @param {string} options.folder - data/fixtures/<folder> to read
 * @param {string} options.envName - the env var name, for errors and logging
 * @param {string | undefined} options.envValue - the env var's value
 * @param {string} options.key - the field that identifies a record
 * @returns {Map<string, any>} file records upserted with the env records
 */
export function loadFixtures({ folder, envName, envValue, key }) {
  const records = new Map(
    readFixtureDir(folder).map((record) => [record[key], record])
  )

  const envRecords = parseFixtureEnv(envName, envValue)
  envRecords.forEach((record, index) => {
    if (typeof record?.[key] !== 'string' || !record[key]) {
      throw new Error(`${envName}[${index}] is missing its "${key}"`)
    }
    records.set(record[key], record)
  })

  if (envRecords.length) {
    logger.info(
      `Upserted ${envRecords.length} ${folder} fixture(s) from ${envName} (${Buffer.byteLength(envValue ?? '')} bytes)`
    )
  }

  return records
}
