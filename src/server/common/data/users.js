import users from '../../../../data/fixtures/users.json' with { type: 'json' }
import { associationForEmail, cphsForEmail } from './locations.js'

// Minimal identity records - sub, email and active status. Everything else
// (name, CPH assignments) is derived from data/fixtures/locations/'s
// associations rather than hand-kept here, so it stays in step with the
// holding data. The OIDC `sub` is the one the IdP fake issues for this
// address (fake/idp defra-ci.json); it's stored here rather than derived so
// the two fakes stay aligned.

/**
 * @typedef {object} User
 * @property {string} sub - the OIDC `sub`, as issued by the IdP fake
 * @property {string} email
 * @property {string | undefined} firstName
 * @property {string | undefined} displayName
 * @property {boolean} active
 * @property {{ cph: string, role: string }[]} cphs
 */

const usersBySub = new Map(
  users.map((user) => {
    const association = associationForEmail(user.email)

    return [
      user.sub,
      {
        ...user,
        firstName: association?.firstName,
        displayName: association?.name,
        cphs: cphsForEmail(user.email)
      }
    ]
  })
)

/**
 * @param {string} sub
 * @returns {User | undefined}
 */
export function findUser(sub) {
  return usersBySub.get(sub)
}
