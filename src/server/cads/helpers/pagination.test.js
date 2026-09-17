import { describe, expect, test } from 'vitest'
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  parsePagingParam,
  paginate
} from './pagination.js'

describe('parsePagingParam()', () => {
  test('it returns the fallback when the value is absent', () => {
    // Arrange
    const value = undefined
    const fallback = 7

    // Act
    const result = parsePagingParam(value, fallback)

    // Assert
    expect(result).toBe(7)
  })

  test('it parses a positive integer string', () => {
    // Arrange
    const value = '3'
    const fallback = DEFAULT_PAGE

    // Act
    const result = parsePagingParam(value, fallback)

    // Assert
    expect(result).toBe(3)
  })

  test('it returns null for a non-numeric value', () => {
    // Arrange
    const value = 'abc'
    const fallback = DEFAULT_PAGE

    // Act
    const result = parsePagingParam(value, fallback)

    // Assert
    expect(result).toBeNull()
  })

  test('it returns null for zero', () => {
    // Arrange
    const value = '0'
    const fallback = DEFAULT_PAGE

    // Act
    const result = parsePagingParam(value, fallback)

    // Assert
    expect(result).toBeNull()
  })

  test('it returns null for a negative value', () => {
    // Arrange
    const value = '-2'
    const fallback = DEFAULT_PAGE

    // Act
    const result = parsePagingParam(value, fallback)

    // Assert
    expect(result).toBeNull()
  })

  test('it returns null for a non-integer value', () => {
    // Arrange
    const value = '1.5'
    const fallback = DEFAULT_PAGE

    // Act
    const result = parsePagingParam(value, fallback)

    // Assert
    expect(result).toBeNull()
  })
})

describe('paginate()', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

  test('it returns the whole collection as page 1 when it fits on one page', () => {
    // Arrange
    const page = DEFAULT_PAGE
    const pageSize = DEFAULT_PAGE_SIZE

    // Act
    const result = paginate(items, page, pageSize)

    // Assert
    expect(result).toEqual({
      resourceType: 'AnimalCollection',
      page: 1,
      pageSize: 25,
      totalPages: 1,
      totalRecords: 8,
      animals: items
    })
  })

  test('it slices to the requested page', () => {
    // Arrange
    const page = 2
    const pageSize = 3

    // Act
    const result = paginate(items, page, pageSize)

    // Assert
    expect(result).toEqual({
      resourceType: 'AnimalCollection',
      page: 2,
      pageSize: 3,
      totalPages: 3,
      totalRecords: 8,
      animals: ['d', 'e', 'f']
    })
  })

  test('it returns an empty page past the end, still reporting the totals', () => {
    // Arrange
    const page = 99
    const pageSize = 3

    // Act
    const result = paginate(items, page, pageSize)

    // Assert
    expect(result.animals).toEqual([])
    expect(result).toMatchObject({
      page: 99,
      pageSize: 3,
      totalPages: 3,
      totalRecords: 8
    })
  })

  test('it reports one page (not zero) for an empty collection', () => {
    // Arrange
    const empty = []
    const page = DEFAULT_PAGE
    const pageSize = DEFAULT_PAGE_SIZE

    // Act
    const result = paginate(empty, page, pageSize)

    // Assert
    expect(result).toEqual({
      resourceType: 'AnimalCollection',
      page: 1,
      pageSize: 25,
      totalPages: 1,
      totalRecords: 0,
      animals: []
    })
  })
})
