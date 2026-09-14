import convict from 'convict'
import convictFormatWithValidator from 'convict-format-with-validator'

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
    doc: 'Service name used in logging',
    format: String,
    default: 'Livestock fake service'
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
      doc: 'Reload the cts-ws XML response templates on change',
      format: Boolean,
      default: isDevelopment
    },
    noCache: {
      doc: 'Disable caching of the cts-ws XML response templates',
      format: Boolean,
      default: isDevelopment
    }
  },
  identityServiceHelper: {
    apiKey: {
      doc: 'x-api-key value the fake identity-service-helper endpoints require, matching its real ApiKeyValidationMiddleware',
      format: String,
      default: 'local-dev-identity-service-helper-key',
      env: 'IDENTITY_SERVICE_HELPER_API_KEY'
    }
  },
  cads: {
    clientId: {
      doc: 'Basic auth client ID (ACL client key) the fake cads-data-service (/cads) endpoints require, matching its real ApiKeyOrCognito Basic-scheme auth policy',
      format: String,
      default: 'local-dev-cads-client',
      env: 'CADS_CLIENT_ID'
    },
    clientSecret: {
      doc: 'Basic auth secret paired with cads.clientId',
      format: String,
      default: 'local-dev-cads-secret',
      env: 'CADS_CLIENT_SECRET'
    }
  },
  krds: {
    clientId: {
      doc: 'Basic auth client ID the fake keeper-data-api (/krds) endpoints require, standing in for its real Bearer-or-Basic auth policy',
      format: String,
      default: 'local-dev-krds-client',
      env: 'KRDS_CLIENT_ID'
    },
    clientSecret: {
      doc: 'Basic auth secret paired with krds.clientId',
      format: String,
      default: 'local-dev-krds-secret',
      env: 'KRDS_CLIENT_SECRET'
    }
  },
  ctsWs: {
    dthUsername: {
      doc: 'TransferDataHex envelope username the fake cts_ws endpoint requires',
      format: String,
      default: 'local-dev-dth-username',
      env: 'CTS_WS_DTH_USERNAME'
    },
    dthPassword: {
      doc: 'TransferDataHex envelope password the fake cts_ws endpoint requires (sent MD5-hashed by callers, matching the real service)',
      format: String,
      default: 'local-dev-dth-password',
      env: 'CTS_WS_DTH_PASSWORD',
      sensitive: true
    },
    ctsOlUsername: {
      doc: 'CTS_OL_User username the fake cts_ws operations require - must be <=11 chars to fit the real CTSOL_UserId_Type XSD constraint',
      format: String,
      default: 'dev-cts-usr',
      env: 'CTS_WS_CTS_OL_USERNAME'
    },
    ctsOlPassword: {
      doc: 'CTS_OL_User password the fake cts_ws operations require - must be <=15 chars to fit the real CTSOL_Password_Type XSD constraint',
      format: String,
      default: 'dev-cts-pass123',
      env: 'CTS_WS_CTS_OL_PASSWORD',
      sensitive: true
    },
    serviceUnavailableProbability: {
      doc: "Probability (0-1) that any TransferDataHex request returns CTWS809 (service unavailable), simulating the real service's occasional outages. 0 disables it.",
      format: Number,
      default: 0.05,
      env: 'CTS_WS_SERVICE_UNAVAILABLE_PROBABILITY'
    },
    births: {
      maxValidationDelaySeconds: {
        doc: "Upper bound (inclusive) of the random delay, in seconds, before a Register_Births_Asynchronous submission's results become available, simulating the real CTS async proving turnaround.",
        format: 'nat',
        default: 5,
        env: 'CTS_WS_BIRTHS_MAX_VALIDATION_DELAY_SECONDS'
      }
    },
    movements: {
      maxValidationDelaySeconds: {
        doc: "Upper bound (inclusive) of the random delay, in seconds, before a Register_Movements_Asynchronous submission's results become available, simulating the real CTS async proving turnaround.",
        format: 'nat',
        default: 5,
        env: 'CTS_WS_MOVEMENTS_MAX_VALIDATION_DELAY_SECONDS'
      }
    }
  }
})

config.validate({ allowed: 'strict' })
