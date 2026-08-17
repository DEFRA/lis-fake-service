import * as getRegisterBirthsValidationResults from './get-register-births-validation-results/index.js'
import * as getRegisterMovementsValidationResults from './get-register-movements-validation-results/index.js'
import * as registerBirthsAsynchronous from './register-births-asynchronous/index.js'
import * as registerMovementsAsynchronous from './register-movements-asynchronous/index.js'

/**
 * Maps a TransferDataHex `type` value to the operation module that handles
 * it. Add a new operation by adding a folder under operations/ with its own
 * `type` and `handle()` exports, then registering it here.
 */
export const operations = {
  [registerBirthsAsynchronous.type]: registerBirthsAsynchronous,
  [getRegisterBirthsValidationResults.type]: getRegisterBirthsValidationResults,
  [registerMovementsAsynchronous.type]: registerMovementsAsynchronous,
  [getRegisterMovementsValidationResults.type]:
    getRegisterMovementsValidationResults
}
