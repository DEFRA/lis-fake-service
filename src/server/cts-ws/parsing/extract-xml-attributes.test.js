import { describe, expect, test } from 'vitest'

import { extractXmlAttributes } from './extract-xml-attributes.js'

describe('extractXmlAttributes()', () => {
  test('it extracts only the present attributes, in the given order', () => {
    // Arrange
    const node = { '@_Etg': 'UK1', '@_MType': 'on' }
    const names = ['RowNum', 'Etg', 'Loc', 'MType']

    // Act
    const result = extractXmlAttributes(node, names)

    // Assert
    expect(result).toEqual({ Etg: 'UK1', MType: 'on' })
    expect(Object.keys(result)).toEqual(['Etg', 'MType'])
  })
})
