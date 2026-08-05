import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { statusCodes } from '../common/constants/status-codes.js'
import { AUTH_STRATEGY } from './auth.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const fixturePath = path.resolve(
  dirname,
  '../../../data/fixtures/identity-service-helper.json'
)

// Keyed by user id (the OIDC `sub`), mirroring identity-service-helper's
// GET /users/{id}/profile — same field names/shape as its UserProfile
// response so consumers can be pointed at either without changes.
const profiles = JSON.parse(readFileSync(fixturePath, 'utf-8'))

function getProfileHandler(request, h) {
  const profile = profiles[request.params.id]

  if (!profile) {
    return h.response().code(statusCodes.notFound)
  }

  return h.response(profile).code(statusCodes.ok)
}

export const usersRoutes = [
  {
    method: 'GET',
    path: '/identity-service-helper/users/{id}/profile',
    options: { auth: AUTH_STRATEGY },
    handler: getProfileHandler
  }
]
