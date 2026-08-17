import { birthCauses } from '../validation/birth.js'
import { Store } from './store.js'

const MAX_DELAY_SECONDS = 5

export const birthStore = new Store(birthCauses, MAX_DELAY_SECONDS)
