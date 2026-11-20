import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { config } from '../../../config/config.js'
import { allAnimals } from '../../common/data/animals.js'
import { dayIndex, exportTags, printedTag } from './tags.js'

vi.mock('../../common/data/animals.js', () => ({ allAnimals: [] }))

const TODAY = new Date('2026-11-20T10:00:00Z')

const mocks = {
  configGet: vi.spyOn(config, 'get')
}

const originalGet = config.get.bind(config)

function useConfig(values) {
  mocks.configGet.mockImplementation((key) =>
    key in values ? values[key] : originalGet(key)
  )
}

function dayRecords(records, exportId) {
  return records.filter((record) => record.Export_Id === exportId)
}

describe('luis tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    allAnimals.length = 0
    vi.useFakeTimers()
    vi.setSystemTime(TODAY)
    useConfig({ 'luis.exportDays': 30, 'luis.tagsPerDay': 1 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('it counts whole UTC days since 2026-01-01', () => {
    // Act
    const index = dayIndex(new Date('2026-11-20T23:59:59Z'))

    // Assert
    expect(index).toBe(323)
  })

  test('it prints the tag with its check digit', () => {
    // Act
    const tag = printedTag('240001', '04599')

    // Assert
    expect(tag).toBe('UK240001304599')
  })

  test("it generates each herd's order for today from the clock", () => {
    // Act
    const todays = dayRecords(exportTags(), 323)

    // Assert
    expect(todays).toHaveLength(20)
    expect(todays.slice(0, 2).map((record) => record.For_Tag)).toEqual([1, 2])
    expect(todays[0]).toMatchObject({
      Entity_Id: 5323000,
      Defra_Ref: '5323000',
      Order_Date: '2026-11-20T09:00:00.0000000',
      Herd: '324798',
      CPH: '03/202/0021'
    })
    expect(todays[0].Tag.Animal_No).toBe(32300)
    expect(todays[0].Tag.Printed_Tag).toBe(printedTag('324798', '32300'))
    expect(todays[1].Tag.Printed_Tag).toBe(todays[0].Tag.Printed_Tag)
    expect(todays[1].Approved_Tag.Tag_Name).toBe('Ultra Button TST')
    expect(todays[2]).toMatchObject({ Entity_Id: 5323001, Herd: '324537' })
    expect(todays[2].Tag.Animal_No).toBe(32300)
  })

  test('it returns 2 records per animal per herd per day, oldest day first', () => {
    // Act
    const records = exportTags()

    // Assert
    expect(records).toHaveLength(600)
    expect(records[0].Export_Id).toBe(294)
    expect(records.at(-1).Export_Id).toBe(323)
  })

  test('a new day adds that days tags and drops the oldest', () => {
    // Arrange
    const before = exportTags()
    vi.setSystemTime(new Date('2026-11-21T10:00:00Z'))

    // Act
    const after = exportTags()

    // Assert
    expect(after).toHaveLength(before.length)
    expect(after[0].Export_Id).toBe(295)
    expect(after.at(-1).Export_Id).toBe(324)
    expect(after.at(-1).Tag.Animal_No).toBe(32400)
  })

  test('it issues each herd its first tagsPerDay candidates in one order', () => {
    // Arrange
    useConfig({ 'luis.exportDays': 1, 'luis.tagsPerDay': 3 })

    // Act
    const herd = exportTags().filter((record) => record.Herd === '324798')

    // Assert
    expect(herd.map((record) => record.Tag.Animal_No)).toEqual([
      32300, 32300, 32301, 32301, 32302, 32302
    ])
    expect(new Set(herd.map((record) => record.Entity_Id))).toEqual(
      new Set([5323000])
    )
  })

  test('it issues 99 distinct tags per herd when tagsPerDay is 99', () => {
    // Arrange
    useConfig({ 'luis.exportDays': 1, 'luis.tagsPerDay': 99 })

    // Act
    const records = exportTags()

    // Assert
    expect(records).toHaveLength(1980)
    expect(new Set(records.map((record) => record.Tag.Printed_Tag)).size).toBe(
      990
    )
  })

  test('it skips candidates an existing animal with that herd mark already uses', () => {
    // Arrange
    useConfig({ 'luis.exportDays': 1, 'luis.tagsPerDay': 2 })
    allAnimals.push({ earTag: 'UK324798032300' }, { earTag: 'UK324537032301' })

    // Act
    const records = exportTags().filter((record) => record.For_Tag === 1)
    const animalNos = (herd) =>
      records
        .filter((record) => record.Herd === herd)
        .map((record) => record.Tag.Animal_No)

    // Assert
    expect(animalNos('324798')).toEqual([32301, 32302])
    expect(animalNos('324537')).toEqual([32300, 32302])
    expect(animalNos('324787')).toEqual([32300, 32301])
  })

  test('it never issues animal number 00000', () => {
    // Arrange
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'))
    useConfig({ 'luis.exportDays': 1, 'luis.tagsPerDay': 2 })

    // Act
    const herd = exportTags().filter((record) => record.Herd === '324798')

    // Assert
    expect(herd.map((record) => record.Tag.Animal_No)).toEqual([1, 1, 2, 2])
  })

  test('it repeats the printed tag but not the Entity_Id 1000 days later', () => {
    // Arrange
    useConfig({ 'luis.exportDays': 1, 'luis.tagsPerDay': 1 })
    const first = exportTags()[0]
    vi.setSystemTime(new Date(TODAY.getTime() + 1000 * 24 * 60 * 60 * 1000))

    // Act
    const later = exportTags()[0]

    // Assert
    expect(later.Tag.Printed_Tag).toBe(first.Tag.Printed_Tag)
    expect(later.Entity_Id).not.toBe(first.Entity_Id)
  })

  test('it skips days before the epoch', () => {
    // Arrange
    vi.setSystemTime(new Date('2026-01-02T10:00:00Z'))

    // Act
    const records = exportTags()

    // Assert
    expect(records).toHaveLength(40)
    expect(records[0].Export_Id).toBe(0)
  })

  test('it fills KeeperDetails from the keeper and holding address', () => {
    // Act
    const [record] = dayRecords(exportTags(), 323)

    // Assert
    expect(record.KeeperDetails).toMatchObject({
      PAON_DESCRIPTION: '1 Old Farm',
      STREET: 'Digger Lane',
      TOWN: 'Leeds',
      ADMINISTRATIVE_AREA: 'West Yorkshire',
      POSTCODE: 'LS1 1AA',
      SAON_DESCRIPTION: ''
    })
    expect(Object.keys(record.KeeperDetails)).toHaveLength(19)
  })
})
