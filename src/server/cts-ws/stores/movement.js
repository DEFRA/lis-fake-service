import { config } from '../../../config/config.js'
import { movementCauses } from '../validation/movement.js'
import { Store } from './store.js'

export const movementStore = new Store(
  movementCauses,
  config.get('ctsWs.movements.maxValidationDelaySeconds')
)
