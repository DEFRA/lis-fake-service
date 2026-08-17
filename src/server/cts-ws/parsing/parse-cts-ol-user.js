/**
 * Extracts the CTS_OL_User Usr/Pwd attributes from a parsed
 * Authentication element (as produced by fast-xml-parser with
 * `attributeNamePrefix: '@_'`).
 *
 * @param {object} authentication
 * @returns {{username: string | undefined, password: string | undefined}}
 */
export function parseCtsOlUser(authentication) {
  const user = authentication?.CTS_OL_User

  return {
    username: user?.['@_Usr'],
    password: user?.['@_Pwd']
  }
}
