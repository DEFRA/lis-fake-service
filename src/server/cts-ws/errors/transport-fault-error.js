/**
 * Thrown for a transport/auth-level failure - wrong TransferDataHex (DTH)
 * envelope credentials - mapped to a SOAP Fault by onPreResponse, matching
 * the real service's layered auth: this gates the whole envelope, as
 * opposed to a DomainError, which is a business-level failure once inside.
 */
export class TransportFaultError extends Error {
  /**
   * @param {string} faultCode
   * @param {string} faultString
   */
  constructor(faultCode, faultString) {
    super(faultString)
    this.name = 'TransportFaultError'
    this.faultCode = faultCode
  }
}
