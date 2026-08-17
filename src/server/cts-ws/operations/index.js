import * as getRegisterBirthsValidationResults from './get-register-births-validation-results.js'
import * as getRegisterMovementsValidationResults from './get-register-movements-validation-results.js'
import * as registerBirthsAsynchronous from './register-births-asynchronous.js'
import * as registerMovementsAsynchronous from './register-movements-asynchronous.js'

/**
 * Maps a TransferDataHex `type` value to the operation module that handles
 * it. Add a new operation by adding a module under operations/ with its own
 * `type` and `handle()` exports, then registering it here.
 */
const operations = {
  [registerBirthsAsynchronous.type]: registerBirthsAsynchronous,
  [getRegisterBirthsValidationResults.type]: getRegisterBirthsValidationResults,
  [registerMovementsAsynchronous.type]: registerMovementsAsynchronous,
  [getRegisterMovementsValidationResults.type]:
    getRegisterMovementsValidationResults
}

/**
 * @param {string} type
 * @returns {{type: string, handle: (innerXml: string) => string} | undefined}
 */
export function getOperation(type) {
  return operations[type]
}
