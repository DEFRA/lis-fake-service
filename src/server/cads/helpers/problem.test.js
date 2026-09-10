import { describe, expect, test, vi } from 'vitest'
import { problem } from './problem.js'

// A minimal Hapi response toolkit: h.response(payload).code(status).
function fakeToolkit() {
  const response = { code: vi.fn().mockReturnThis() }
  return {
    response,
    h: { response: vi.fn().mockReturnValue(response) }
  }
}

describe('problem()', () => {
  test('it builds an RFC 7807 ProblemDetails body and sets the status code', () => {
    // Arrange
    const { h, response } = fakeToolkit()
    const status = 404
    const title = 'Not Found'
    const detail = 'No animal found for identifier UK000000000000.'

    // Act
    const result = problem(h, status, title, detail)

    // Assert
    expect(h.response).toHaveBeenCalledWith({
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.5',
      title,
      status,
      detail
    })
    expect(response.code).toHaveBeenCalledWith(404)
    expect(result).toBe(response)
  })
})
