import { v5 as uuidv5 } from 'uuid'
import users from '../../../../data/fixtures/users.json' with { type: 'json' }

// Minimal user records - identity plus a list of { cph, role }. The OIDC `sub`
// isn't stored; it's derived from the email so it stays stable and matches
// whatever an IdP fake issues for the same address.
const USER_NAMESPACE = uuidv5('uk.gov.defra.lis.fake-service.user', uuidv5.DNS)

/**
 * @typedef {object} User
 * @property {string} id - the OIDC `sub`, derived from `email`
 * @property {string} email
 * @property {string} firstName
 * @property {string} displayName
 * @property {boolean} active
 * @property {{ cph: string, role: string }[]} cphs
 */

/**
 * @param {string} email
 * @returns {string} the user's `sub`
 */
export function userId(email) {
  return uuidv5(email, USER_NAMESPACE)
}

const usersById = new Map(
  users.map((user) => {
    const id = userId(user.email)
    return [id, { id, ...user }]
  })
)

/**
 * @param {string} id
 * @returns {User | undefined}
 */
export function findUser(id) {
  return usersById.get(id)
}
