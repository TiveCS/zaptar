import type { ZaptarBridge } from './index'

declare global {
  interface Window {
    zaptar: ZaptarBridge
  }
}

export {}
