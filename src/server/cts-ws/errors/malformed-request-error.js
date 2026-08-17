/**
 * Thrown when the raw TransferDataHex request body isn't a well-formed SOAP
 * envelope. Mapped to a 400 with no body by onPreResponse - not something
 * the real service has a documented response shape for, since a real
 * client never sends malformed XML.
 */
export class MalformedRequestError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message)
    this.name = 'MalformedRequestError'
  }
}
