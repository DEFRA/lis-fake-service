import { randomUUID } from 'node:crypto'
import { v5 as uuidv5 } from 'uuid'
import users from '../../../../data/fixtures/users.json' with { type: 'json' }
import {
  associationForEmail,
  cphsForEmail,
  findLocation,
  holdingId
} from '../../common/data/locations.js'

// Namespaces for ids derived from stable inputs, so they don't change
// between calls without being stored.
const ACCOUNT_NAMESPACE = uuidv5(
  'uk.gov.defra.lis.fake-service.krds.account',
  uuidv5.DNS
)
const ASSOCIATION_NAMESPACE = uuidv5(
  'uk.gov.defra.lis.fake-service.krds.cph-association',
  uuidv5.DNS
)

// The fixed instant the seeded accounts were "last refreshed" at server
// start, so tests get a deterministic value rather than Date.now().
const SEED_TIMESTAMP = '2024-01-01T00:00:00.000Z'

function toCphAssociationDto(email, { cph, role }) {
  const location = findLocation(cph)

  return {
    id: uuidv5(`${email}:${cph}:${role}`, ASSOCIATION_NAMESPACE),
    cphNumber: cph,
    role,
    partyId: null,
    holdingId: holdingId(cph) ?? null,
    holdingName: location?.name ?? null
  }
}

/**
 * @typedef {object} EnsureResult
 * @property {object} account - the resulting UserAccountDto
 * @property {boolean} created - whether a brand new account was created
 */

/**
 * In-memory stand-in for keeper-data-api's user account store: ensures an
 * account per ensureAccount() call (create, adopt-by-email or refresh by
 * subject) and serves it back by subject. Seeded from
 * data/fixtures/users.json at construction so the pre-existing identities
 * identity-service-helper's fake already knows about resolve immediately.
 */
export class KrdsUserDataStore {
  /**
   * Seeds the store from data/fixtures/users.json.
   */
  constructor() {
    this.accountsById = new Map(
      users.map((user) => {
        const account = this.#seedAccount(user)
        return [account.id, account]
      })
    )
  }

  /**
   * @param {{ sub: string, email: string, active: boolean }} user
   * @returns {object} a seeded UserAccountDto
   */
  #seedAccount(user) {
    const association = associationForEmail(user.email)

    return {
      id: uuidv5(user.email, ACCOUNT_NAMESPACE),
      subject: user.sub,
      email: user.email,
      firstName: association?.firstName ?? null,
      lastName: association?.lastName ?? null,
      displayName: association?.name ?? null,
      cphAssociations: cphsForEmail(user.email).map((assoc) =>
        toCphAssociationDto(user.email, assoc)
      ),
      associationsRefreshedDate: SEED_TIMESTAMP,
      lastUpdatedDate: SEED_TIMESTAMP
    }
  }

  /**
   * @param {string} subject
   * @returns {object | undefined}
   */
  #findBySubject(subject) {
    return [...this.accountsById.values()].find(
      (account) => account.subject === subject
    )
  }

  /**
   * @param {string} email
   * @returns {object | undefined}
   */
  #findByEmail(email) {
    return [...this.accountsById.values()].find(
      (account) => account.email === email
    )
  }

  /**
   * Resolves the account a POSTed subject/email pair should act on: an
   * exact subject match, an email match with no subject bound yet
   * (adopted in place), or a freshly created account. Does not touch
   * profile/association fields - see #refresh().
   *
   * @param {string | null | undefined} sub
   * @param {string} email
   * @returns {{ account: object, created: boolean } | { conflict: true }}
   */
  #resolveAccount(sub, email) {
    const bySubject = sub ? this.#findBySubject(sub) : undefined
    if (bySubject) {
      return { account: bySubject, created: false }
    }

    const byEmail = this.#findByEmail(email)
    if (byEmail) {
      if (byEmail.subject && byEmail.subject !== sub) {
        return { conflict: true }
      }
      byEmail.subject = sub ?? byEmail.subject
      return { account: byEmail, created: false }
    }

    const account = {
      id: randomUUID(),
      subject: sub ?? null,
      email,
      firstName: null,
      lastName: null,
      displayName: null,
      cphAssociations: [],
      associationsRefreshedDate: null,
      lastUpdatedDate: null
    }
    this.accountsById.set(account.id, account)
    return { account, created: true }
  }

  /**
   * Overwrites an account's profile fields and rebuilds its CPH
   * association snapshot from the location records (standing in for the
   * SAM read model).
   *
   * @param {object} account
   * @param {{ email: string, given_name?: string | null, family_name?: string | null }} claims
   */
  #refresh(account, { email, given_name: firstName, family_name: lastName }) {
    const now = new Date().toISOString()

    account.email = email
    account.firstName = firstName ?? null
    account.lastName = lastName ?? null
    account.displayName =
      firstName && lastName ? `${firstName} ${lastName}` : null
    account.cphAssociations = cphsForEmail(email).map((assoc) =>
      toCphAssociationDto(email, assoc)
    )
    account.associationsRefreshedDate = now
    account.lastUpdatedDate = now
  }

  /**
   * @param {string} subject
   * @returns {object | undefined} the stored UserAccountDto, or undefined
   *   if the subject isn't recognised
   */
  findAccount(subject) {
    return this.#findBySubject(subject)
  }

  /**
   * Resolves an account by subject, otherwise adopts an account which
   * matches on email and has no subject bound yet, otherwise creates a new
   * account. The CPH association snapshot is rebuilt from the location
   * records (standing in for the SAM read model) on every call.
   *
   * @param {{ sub?: string | null, email: string, given_name?: string | null, family_name?: string | null }} claims
   * @returns {EnsureResult | { conflict: true }} the ensured account, or
   *   `{ conflict: true }` when the email is already bound to a different
   *   subject
   */
  ensureAccount(claims) {
    const resolved = this.#resolveAccount(claims.sub, claims.email)

    if (resolved.conflict) {
      return resolved
    }

    this.#refresh(resolved.account, claims)

    return resolved
  }
}

export const userAccountStore = new KrdsUserDataStore()
