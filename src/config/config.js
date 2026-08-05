import convict from 'convict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import convictFormatWithValidator from 'convict-format-with-validator'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const oneWeekMs = 604800000

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const isDevelopment = process.env.NODE_ENV === 'development'

convict.addFormats(convictFormatWithValidator)

export const config = convict({
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind',
    format: 'port',
    default: 3000,
    env: 'PORT'
  },
  serviceName: {
    doc: 'Service name shown in the GOV.UK header',
    format: String,
    default: 'Livestock fake service'
  },
  root: {
    doc: 'Project root',
    format: String,
    default: path.resolve(dirname, '../..')
  },
  assetPath: {
    doc: 'Asset path prefix',
    format: String,
    default: '/public',
    env: 'ASSET_PATH'
  },
  staticCacheTimeout: {
    doc: 'Static asset cache TTL in milliseconds',
    format: Number,
    default: oneWeekMs,
    env: 'STATIC_CACHE_TIMEOUT'
  },
  isProduction: {
    doc: 'Whether the app is running in production',
    format: Boolean,
    default: isProduction
  },
  isDevelopment: {
    doc: 'Whether the app is running in development',
    format: Boolean,
    default: isDevelopment
  },
  isTest: {
    doc: 'Whether the app is running in test',
    format: Boolean,
    default: isTest
  },
  log: {
    enabled: {
      doc: 'Whether logging is enabled',
      format: Boolean,
      default: process.env.NODE_ENV !== 'test',
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Log level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Log output format',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : []
    }
  },
  nunjucks: {
    watch: {
      doc: 'Reload templates on change',
      format: Boolean,
      default: isDevelopment
    },
    noCache: {
      doc: 'Disable template caching',
      format: Boolean,
      default: isDevelopment
    }
  },
  oidcFakes: {
    entraId: {
      externalBase: {
        doc: 'Browser-visible base URL for the Entra ID fake (used in the authorization redirect). Falls back to internalBase when unset.',
        format: String,
        nullable: true,
        default: null,
        env: 'ENTRA_ID_EXTERNAL_BASE'
      },
      internalBase: {
        doc: 'Server-to-server base URL for the Entra ID fake (issuer, token, jwks endpoints)',
        format: String,
        default: 'http://localhost:3000/entra-id',
        env: 'ENTRA_ID_INTERNAL_BASE'
      }
    },
    defraCi: {
      externalBase: {
        doc: 'Browser-visible base URL for the DEFRA CI fake (used in the authorization redirect). Falls back to internalBase when unset.',
        format: String,
        nullable: true,
        default: null,
        env: 'DEFRA_CI_EXTERNAL_BASE'
      },
      internalBase: {
        doc: 'Server-to-server base URL for the DEFRA CI fake (issuer, token, jwks endpoints)',
        format: String,
        default: 'http://localhost:3000/defra-ci',
        env: 'DEFRA_CI_INTERNAL_BASE'
      }
    }
  },
  identityServiceHelper: {
    apiKey: {
      doc: 'x-api-key value the fake identity-service-helper endpoints require, matching its real ApiKeyValidationMiddleware',
      format: String,
      default: 'local-dev-identity-service-helper-key',
      env: 'IDENTITY_SERVICE_HELPER_API_KEY'
    }
  }
})

config.validate({ allowed: 'strict' })
