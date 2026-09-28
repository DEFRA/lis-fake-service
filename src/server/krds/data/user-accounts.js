import { randomUUID } from 'node:crypto'
import { v5 as uuidv5 } from 'uuid'
import {
  cphsForEmail,
  findLocation,
  holdingId
} from '../../common/data/locations.js'

// Namespace for cph-association ids derived from stable inputs, so they
// don't change between calls without being stored.
const ASSOCIATION_NAMESPACE = uuidv5(
  'uk.gov.defra.lis.fake-service.krds.cph-association',
  uuidv5.DNS
)

// Shapes mirror keeper-data-api's OpenAPI (v2) schemas of the same name.

/**
 * @typedef {object} CphAssociationDto
 * @property {string} id
 * @property {string} cphNumber
 * @property {string} role
 * @property {string | null} partyId
 * @property {string | null} holdingId
 * @property {string | null} holdingName
 */

/**
 * @typedef {object} UserAccountDto
 * @property {string} id
 * @property {string | null} subject
 * @property {string} email
 * @property {string | null} firstName
 * @property {string | null} lastName
 * @property {string | null} displayName
 * @property {CphAssociationDto[]} cphAssociations
 * @property {string | null} associationsRefreshedDate
 * @property {string | null} lastUpdatedDate - null only until the account's
 *   first refresh; the API itself never returns null here
 */

/**
 * @param {string} email
 * @param {{ cph: string, role: string }} association
 * @returns {CphAssociationDto}
 */
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
 * @property {UserAccountDto} account - the resulting account
 * @property {boolean} created - whether a brand new account was created
 */

/**
 * In-memory stand-in for keeper-data-api's user account store: ensures an
 * account per ensureAccount() call (create, adopt-by-email or refresh by
 * subject) and serves it back by subject.
 */
export class KrdsUserDataStore {
  /**
   * Starts with an empty store - accounts only exist once ensureAccount()
   * creates them.
   */
  constructor() {
    /** @type {Map<string, UserAccountDto>} */
    this.accountsById = new Map()
  }

  /**
   * @param {string} subject
   * @returns {UserAccountDto | undefined}
   */
  #findBySubject(subject) {
    return [...this.accountsById.values()].find(
      (account) => account.subject === subject
    )
  }

  /**
   * @param {string} email
   * @returns {UserAccountDto | undefined}
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
   * @returns {EnsureResult | { conflict: true }}
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
   * @param {UserAccountDto} account
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
   * @returns {UserAccountDto | undefined} the stored account, or undefined
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
