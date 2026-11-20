import { config } from '../../../config/config.js'
import { allAnimals } from '../../common/data/animals.js'
import { allLocations } from '../../common/data/locations.js'

/** @import { Location } from '../../common/data/locations.js' */

const MILLISECONDS_PER_DAY = 86400000
const EPOCH_YEAR = 2026
const EPOCH_MILLISECONDS = Date.UTC(EPOCH_YEAR, 0, 1)
const CHECK_DIGIT_MODULUS = 7
const ANIMAL_NUMBER_DIGITS = 5
const HERD_MARK_DIGITS = 6
const DATE_LENGTH = 10
const FIRST_TAG = 1
const SECOND_TAG = 2
const TAG_NUMBERS = [FIRST_TAG, SECOND_TAG]
// Every herd has this many candidate animal numbers each day; it is issued
// the first tagsPerDay of them that no existing animal already uses.
const CANDIDATES_PER_DAY = 100
// The printed animal number has 5 digits, so it wraps every 1000 days and
// tags repeat after about 2.7 years (Entity_Id keeps counting).
const ANIMAL_NUMBER_RANGE = 100000
const FIRST_ENTITY_ID = 5000000
// One order per herd per day: Entity_Id = first id + day * this + herd position.
const ENTITY_IDS_PER_DAY = 1000
// UK, 6-digit herd mark, check digit, 5-digit animal number. The check digit
// is ignored when matching: fixture tags do not all carry a valid one.
const EAR_TAG_PATTERN = /^UK(?<herdMark>\d{6})\d(?<animalNo>\d{5})$/
const KEEPER_ROLE = 'keeper'

const APPROVED_TAGS = {
  1: {
    Approved_Tag_Id: 1085,
    Tag_Name: 'Ultra Junior Visual',
    Tag_EID: false,
    Tag_Primary: true,
    Tag_Slaughter: false,
    Legacy_Code: '050_0',
    Manufacturers_Code: null,
    Tag_Class_Name: 'Flag'
  },
  2: {
    Approved_Tag_Id: 1156,
    Tag_Name: 'Ultra Button TST',
    Tag_EID: false,
    Tag_Primary: false,
    Tag_Slaughter: false,
    Legacy_Code: '050_E',
    Manufacturers_Code: null,
    Tag_Class_Name: 'Button'
  }
}

const MANUFACTURER = {
  Manufacturer_Id: 33,
  Manufacturer_Name: 'Allflex UK Group Ltd',
  ETAS_Id: '50',
  CETAS_Id: '050'
}

/**
 * @typedef {object} Herd
 * @property {string} mark - the 6 digits of the herd mark
 * @property {Location} location
 */

/**
 * @param {Date} date
 * @returns {number} whole UTC days since 2026-01-01
 */
export function dayIndex(date) {
  return Math.floor(
    (date.getTime() - EPOCH_MILLISECONDS) / MILLISECONDS_PER_DAY
  )
}

/**
 * @param {Location} location
 * @returns {string | undefined} the 6 digits of the location's first current
 *   cattle herd mark, or undefined when it has none or it is not 6 digits
 */
function cattleHerdMark(location) {
  const mark = location.marks.find(
    (candidate) => candidate.species.includes('Cattle') && !candidate.endDate
  )
  const digits = mark?.mark.replace(/\D/g, '')
  return digits?.length === HERD_MARK_DIGITS ? digits : undefined
}

/**
 * @returns {Herd[]} one herd per active location with a current cattle mark, ordered by CPH
 */
function herds() {
  return allLocations()
    .filter((location) => location.status === 'active')
    .flatMap((location) => {
      const mark = cattleHerdMark(location)
      return mark ? [{ mark, location }] : []
    })
    .sort((a, b) => a.location.identifier.localeCompare(b.location.identifier))
}

/**
 * @param {string} herdMark
 * @param {string} paddedAnimalNo
 * @returns {string} the printed tag, e.g. UK240001304599
 */
export function printedTag(herdMark, paddedAnimalNo) {
  const checkDigit =
    (Number(herdMark + paddedAnimalNo) % CHECK_DIGIT_MODULUS) + 1
  return `UK${herdMark}${checkDigit}${paddedAnimalNo}`
}

/**
 * @param {string | null | undefined} value
 * @returns {string} the value, or '' when absent
 */
function text(value) {
  return value ?? ''
}

/**
 * @param {Location} location
 * @returns {object} the keeper details for the location, '' where unknown
 */
function keeperDetails(location) {
  const association =
    location.associations.find((candidate) =>
      candidate.roles.some((role) => role.code === KEEPER_ROLE)
    ) ?? location.associations[0]
  const address = location.location.address

  return {
    OCCUPIER_TITLE: text(association?.title),
    OCCUPIER_NAME: text(association?.name),
    SAON_START_NUMBER: '',
    SAON_START_NUMBER_SUFFIX: '',
    SAON_END_NUMBER: '',
    SAON_END_NUMBER_SUFFIX: '',
    SAON_DESCRIPTION: '',
    PAON_START_NUMBER: '',
    PAON_START_NUMBER_SUFFIX: '',
    PAON_END_NUMBER: '',
    PAON_END_NUMBER_SUFFIX: '',
    PAON_DESCRIPTION: text(address.addressLine1),
    STREET: text(address.addressLine2),
    LOCALITY: '',
    TOWN: text(address.postTown),
    ADMINISTRATIVE_AREA: text(address.locality),
    POSTCODE: text(address.postcode),
    TELEPHONE: text(association?.telephone),
    MOBILE_NUMBER: text(association?.mobile)
  }
}

/**
 * @param {number} day
 * @returns {string} the order date, e.g. 2026-11-20T09:00:00.0000000
 */
function orderDate(day) {
  const date = new Date(EPOCH_MILLISECONDS + day * MILLISECONDS_PER_DAY)
  return `${date.toISOString().slice(0, DATE_LENGTH)}T09:00:00.0000000`
}

/**
 * @param {number} animalNo
 * @returns {string} the animal number as it is printed, e.g. 04599
 */
function padAnimalNo(animalNo) {
  return String(animalNo).padStart(ANIMAL_NUMBER_DIGITS, '0')
}

/**
 * @returns {Set<string>} herd mark + animal number of every existing animal
 */
function existingAnimalKeys() {
  return new Set(
    allAnimals.flatMap((animal) => {
      const groups = EAR_TAG_PATTERN.exec(animal.earTag)?.groups
      return groups ? [groups.herdMark + groups.animalNo] : []
    })
  )
}

/**
 * @param {number} day
 * @returns {number[]} the day's candidate animal numbers, in issue order;
 *   00000 is never a candidate
 */
function candidateAnimalNos(day) {
  return Array.from(
    { length: CANDIDATES_PER_DAY },
    (_, slot) => (day * CANDIDATES_PER_DAY + slot) % ANIMAL_NUMBER_RANGE
  ).filter((animalNo) => animalNo !== 0)
}

/**
 * @param {{ day: number, entityId: number, animalNo: number, herd: Herd, forTag: 1 | 2 }} order
 * @returns {object} one export record
 */
function record({ day, entityId, animalNo, herd, forTag }) {
  return {
    Entity_Type: 'O',
    Entity_Id: entityId,
    Export_Id: day,
    Status: 'New',
    Country: 'UK',
    CPH: herd.location.identifier,
    Herd: herd.mark,
    For_Tag: forTag,
    Tag_Replica_Count: 0,
    Replacement: false,
    Order_Type_Id: 'Conventional',
    Order_Date: orderDate(day),
    Species: 'C',
    Defra_Ref: String(entityId),
    Colour: 'Yellow',
    Species_Iso: 2,
    Replica_Count_Display: 0,
    Tag: {
      Animal_No: animalNo,
      HasEID: false,
      HasInternal: false,
      Upgraded_To_EID: false,
      Printed_Tag: printedTag(herd.mark, padAnimalNo(animalNo)),
      Link_Tag: null,
      Upgrade_Tag: null
    },
    Manufacturer: MANUFACTURER,
    Approved_Tag: APPROVED_TAGS[forTag],
    KeeperDetails: keeperDetails(herd.location)
  }
}

/**
 * @param {number} day
 * @param {Herd[]} herdList
 * @param {Set<string>} existing - herd mark + animal number of existing animals
 * @returns {object[]} each herd's order for the day: both records for each
 *   of its first tagsPerDay candidates no existing animal uses
 */
function recordsForDay(day, herdList, existing) {
  const tagsPerDay = config.get('luis.tagsPerDay')
  const candidates = candidateAnimalNos(day)

  return herdList.flatMap((herd, herdPosition) => {
    const entityId = FIRST_ENTITY_ID + day * ENTITY_IDS_PER_DAY + herdPosition
    return candidates
      .filter((animalNo) => !existing.has(herd.mark + padAnimalNo(animalNo)))
      .slice(0, tagsPerDay)
      .flatMap((animalNo) =>
        TAG_NUMBERS.map((forTag) =>
          record({ day, entityId, animalNo, herd, forTag })
        )
      )
  })
}

/**
 * @returns {object[]} the export records for the last exportDays UTC days,
 *   ending today, oldest first; empty when no herds exist
 */
export function exportTags() {
  const herdList = herds()
  const existing = existingAnimalKeys()
  const today = dayIndex(new Date())
  const firstDay = Math.max(today - config.get('luis.exportDays') + 1, 0)

  return Array.from({ length: today - firstDay + 1 }, (_, offset) =>
    recordsForDay(firstDay + offset, herdList, existing)
  ).flat()
}
