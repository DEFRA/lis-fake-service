import { birthStore } from '../stores/birth.js'
import { createGetValidationResultsHandler } from './get-validation-results.js'

export const type = 'Get_Register_Births_Validation_Results-V1-0'

/**
 * Handles a decoded Get_Register_Births_Validation_Results payload by
 * polling the birth store; see createGetValidationResultsHandler.
 *
 * @type {(innerXml: string) => Promise<string>}
 */
export const handle = createGetValidationResultsHandler({
  type,
  store: birthStore,
  template: 'operations/get-register-births-validation-results.njk'
})
