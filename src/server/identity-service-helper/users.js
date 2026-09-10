import { v5 as uuidv5 } from 'uuid'
import { statusCodes } from '../common/constants/status-codes.js'
import { holdingId } from '../common/data/locations.js'
import { findUser } from '../common/data/users.js'
import { AUTH_STRATEGY } from './auth.js'

// Namespaces for the ids derived per assignment - stable, not stored.
const ASSIGNMENT_NAMESPACE = uuidv5(
  'uk.gov.defra.lis.fake-service.assignment',
  uuidv5.DNS
)
const ROLE_NAMESPACE = uuidv5('uk.gov.defra.lis.fake-service.role', uuidv5.DNS)

// Expands a minimal user record into identity-service-helper's UserProfile
// shape - same field names as the real response so consumers can point at
// either.
function toProfile(user) {
  return {
    userDetails: {
      id: user.sub,
      email: user.email,
      firstName: user.firstName,
      displayName: user.displayName,
      active: user.active
    },
    directAssignments: user.cphs.map(({ cph, role }) => ({
      id: uuidv5(`${user.sub}:${cph}`, ASSIGNMENT_NAMESPACE),
      countyParishHoldingId: holdingId(cph),
      countyParishHoldingNumber: cph,
      userId: user.sub,
      roleId: uuidv5(role, ROLE_NAMESPACE),
      roleName: role,
      email: user.email,
      displayName: user.displayName
    })),
    inboundDelegations: [],
    outboundDelegations: []
  }
}

function getProfileHandler(request, h) {
  const user = findUser(request.params.id)

  if (!user) {
    return h.response().code(statusCodes.notFound)
  }

  return h.response(toProfile(user)).code(statusCodes.ok)
}

export const usersRoutes = [
  {
    method: 'GET',
    path: '/identity-service-helper/users/{id}/profile',
    options: { auth: AUTH_STRATEGY },
    handler: getProfileHandler
  }
]
