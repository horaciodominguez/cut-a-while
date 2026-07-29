declare global {
  function acquireVsCodeApi(): {
    postMessage: (msg: unknown) => void
    getState: () => unknown
    setState: (state: unknown) => void
  }
}

const api = acquireVsCodeApi()

export function postMessage(msg: Record<string, unknown>) {
  api.postMessage(msg)
}

export function getVsCodeState(): unknown {
  return api.getState()
}

export function setVsCodeState(state: unknown) {
  api.setState(state)
}
