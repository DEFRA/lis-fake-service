import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'
import { config } from '../../../config/config.js'
import { catchAll } from './errors.js'
import { statusCodes } from '../constants/status-codes.js'

const configValues = {
  isProduction: false
}

const mocks = vi.hoisted(() => ({
  loggerError: vi.fn()
}))

vi.mock('./logging/logger.js', () => ({
  logger: { error: mocks.loggerError }
}))

mocks.configGet = vi.spyOn(config, 'get')

function makeH() {
  const h = {
    view: vi.fn(() => h),
    code: vi.fn(() => h),
    continue: Symbol('continue')
  }
  return h
}

function boomResponse({ statusCode, message = 'boom' }) {
  return {
    isBoom: true,
    message,
    stack: `Error: ${message}`,
    output: { statusCode }
  }
}

describe('catchAll', () => {
  beforeAll(() => {
    mocks.configGet.mockImplementation((key) => configValues[key])
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    configValues.isProduction = false
  })

  test('it passes through a response that is not a Boom error', () => {
    // Arrange
    const request = { response: { some: 'success response' } }
    const h = makeH()

    // Act
    const result = catchAll(request, h)

    // Assert
    expect(result).toBe(h.continue)
    expect(h.view).not.toHaveBeenCalled()
  })

  test('it renders the 404 page for a not found error', () => {
    // Arrange
    const request = {
      response: boomResponse({ statusCode: statusCodes.notFound })
    }
    const h = makeH()

    // Act
    catchAll(request, h)

    // Assert
    expect(h.view).toHaveBeenCalledWith(
      'error/index',
      expect.objectContaining({
        pageTitle: 'Page not found',
        heading: statusCodes.notFound,
        message: 'Page not found'
      })
    )
    expect(h.code).toHaveBeenCalledWith(statusCodes.notFound)
  })

  test('it renders the forbidden page for a forbidden error', () => {
    // Arrange
    const request = {
      response: boomResponse({ statusCode: statusCodes.forbidden })
    }
    const h = makeH()

    // Act
    catchAll(request, h)

    // Assert
    expect(h.view).toHaveBeenCalledWith(
      'error/index',
      expect.objectContaining({ message: 'Forbidden' })
    )
  })

  test('it renders the unauthorized page for an unauthorized error', () => {
    // Arrange
    const request = {
      response: boomResponse({ statusCode: statusCodes.unauthorized })
    }
    const h = makeH()

    // Act
    catchAll(request, h)

    // Assert
    expect(h.view).toHaveBeenCalledWith(
      'error/index',
      expect.objectContaining({ message: 'Unauthorized' })
    )
  })

  test('it renders the bad request page for a bad request error', () => {
    // Arrange
    const request = {
      response: boomResponse({ statusCode: statusCodes.badRequest })
    }
    const h = makeH()

    // Act
    catchAll(request, h)

    // Assert
    expect(h.view).toHaveBeenCalledWith(
      'error/index',
      expect.objectContaining({ message: 'Bad Request' })
    )
  })

  test('it renders a generic message for any other status code', () => {
    // Arrange
    const request = {
      response: boomResponse({ statusCode: statusCodes.internalServerError })
    }
    const h = makeH()

    // Act
    catchAll(request, h)

    // Assert
    expect(h.view).toHaveBeenCalledWith(
      'error/index',
      expect.objectContaining({ message: 'Something went wrong' })
    )
  })

  test('it logs the error stack for a 500-and-above status code', () => {
    // Arrange
    const response = boomResponse({
      statusCode: statusCodes.internalServerError
    })
    const request = { response }
    const h = makeH()

    // Act
    catchAll(request, h)

    // Assert
    expect(mocks.loggerError).toHaveBeenCalledWith(response.stack)
  })

  test('it does not log below a 500 status code', () => {
    // Arrange
    const request = {
      response: boomResponse({ statusCode: statusCodes.notFound })
    }
    const h = makeH()

    // Act
    catchAll(request, h)

    // Assert
    expect(mocks.loggerError).not.toHaveBeenCalled()
  })

  test('it includes the real error message outside production', () => {
    // Arrange
    const request = {
      response: boomResponse({
        statusCode: statusCodes.internalServerError,
        message: 'something broke unexpectedly'
      })
    }
    const h = makeH()

    // Act
    catchAll(request, h)

    // Assert
    expect(h.view).toHaveBeenCalledWith(
      'error/index',
      expect.objectContaining({ devMessage: 'something broke unexpectedly' })
    )
  })

  test('it omits the real error message in production', () => {
    // Arrange
    configValues.isProduction = true
    const request = {
      response: boomResponse({
        statusCode: statusCodes.internalServerError,
        message: 'something broke unexpectedly'
      })
    }
    const h = makeH()

    // Act
    catchAll(request, h)

    // Assert
    const [, payload] = h.view.mock.calls[0]
    expect(payload).not.toHaveProperty('devMessage')
  })
})
