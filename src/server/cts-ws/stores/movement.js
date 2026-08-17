import { movementCauses } from '../validation/movement.js'
import { Store } from './store.js'

const MAX_DELAY_SECONDS = 5

export const movementStore = new Store(movementCauses, MAX_DELAY_SECONDS)
