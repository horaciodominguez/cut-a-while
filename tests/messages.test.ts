import { describe, expect, it } from 'vitest'
import { isWebviewToHostMessage } from '../src/shared/messages.js'

describe('isWebviewToHostMessage', () => {
  it('accepts known commands', () => {
    expect(isWebviewToHostMessage({ command: 'confirmStop' })).toBe(true)
    expect(isWebviewToHostMessage({ command: 'previewSound', theme: 'bell', type: 'break' })).toBe(true)
  })

  it('rejects unknown commands and non-objects', () => {
    expect(isWebviewToHostMessage({ command: 'explode' })).toBe(false)
    expect(isWebviewToHostMessage(null)).toBe(false)
    expect(isWebviewToHostMessage('start')).toBe(false)
  })
})
