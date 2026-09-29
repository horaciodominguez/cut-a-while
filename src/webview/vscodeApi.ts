import type { WebviewToHostMessage } from '../shared/messages.ts'

declare global {
  function acquireVsCodeApi(): {
    postMessage: (msg: unknown) => void
    getState: () => unknown
    setState: (state: unknown) => void
  }
}

const api = acquireVsCodeApi()

export function postMessage(msg: WebviewToHostMessage) {
  api.postMessage(msg)
}

export function getVsCodeState(): unknown {
  return api.getState()
}

export function setVsCodeState(state: unknown) {
  api.setState(state)
}
