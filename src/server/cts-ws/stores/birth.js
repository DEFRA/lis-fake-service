import { config } from '../../../config/config.js'
import { birthCauses } from '../validation/birth.js'
import { Store } from './store.js'

export const birthStore = new Store(
  birthCauses,
  config.get('ctsWs.births.maxValidationDelaySeconds')
)
