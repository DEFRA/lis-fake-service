import { describe, expect, test } from 'vitest'

import { decodeDataPayload, encodeDataPayload } from './soap-envelope.js'

describe('soap-envelope', () => {
  test('encodeDataPayload and decodeDataPayload round-trip an XML fragment', () => {
    // Arrange
    const xmlFragment = '<Foo Bar="baz"/>'

    // Act
    const encoded = encodeDataPayload(xmlFragment)
    const decoded = decodeDataPayload(encoded)

    // Assert
    expect(decoded).toBe(
      '<?xml version="1.0" encoding="utf-8"?><Foo Bar="baz"/>'
    )
  })
})
