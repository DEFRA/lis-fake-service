import users from '../../../../data/fixtures/users.json' with { type: 'json' }

// Minimal user records - identity plus a list of { cph, role }. The OIDC `sub`
// is the one the IdP fake issues for this address (fake/idp defra-ci.json); it's
// stored here rather than derived so the two fakes stay aligned.

/**
 * @typedef {object} User
 * @property {string} sub - the OIDC `sub`, as issued by the IdP fake
 * @property {string} email
 * @property {string} firstName
 * @property {string} displayName
 * @property {boolean} active
 * @property {{ cph: string, role: string }[]} cphs
 */

const usersBySub = new Map(users.map((user) => [user.sub, user]))

/**
 * @param {string} sub
 * @returns {User | undefined}
 */
export function findUser(sub) {
  return usersBySub.get(sub)
}
