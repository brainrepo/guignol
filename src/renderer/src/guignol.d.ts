import type { GuignolApi } from '../../preload/index'

declare global {
  interface Window {
    guignol: GuignolApi
  }
}

export {}
