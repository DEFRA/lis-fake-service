/**
 * Thrown by an operation handler for a business-level failure (bad
 * credentials, unknown records, etc). Caught by the top-level
 * TransferDataHex handler and rendered as a SystemException, matching how
 * the real service returns domain errors inside an otherwise-successful
 * (HTTP 200) response.
 */
export class DomainError extends Error {
  /**
   * @param {string} exNum - the SystemException's required ExNum code (e.g. 'CTWS803').
   * @param {string} message - the SystemException's required ExMsg text.
   */
  constructor(exNum, message) {
    super(message)
    this.name = 'DomainError'
    this.exNum = exNum
  }
}
