import { movementStore } from '../stores/movement.js'
import { createGetValidationResultsHandler } from './get-validation-results.js'

export const type = 'Get_Register_Movements_Validation_Results-V1-0'

/**
 * Handles a decoded Get_Register_Movements_Validation_Results payload by
 * polling the movement store; see createGetValidationResultsHandler.
 *
 * @type {(innerXml: string) => Promise<string>}
 */
export const handle = createGetValidationResultsHandler({
  type,
  store: movementStore,
  template: 'operations/get-register-movements-validation-results.njk'
})
