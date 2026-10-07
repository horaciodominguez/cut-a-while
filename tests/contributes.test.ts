import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  contributes: {
    commands: Array<{ command: string }>
    keybindings?: unknown
    menus?: { 'view/title'?: unknown }
  }
}

describe('package contributions', () => {
  it('does not bind Ctrl+Shift+T or add timer actions to the tree title', () => {
    expect(pkg.contributes.keybindings).toBeUndefined()
    expect(pkg.contributes.menus?.['view/title']).toBeUndefined()
    expect(pkg.contributes.commands.map((command) => command.command)).toEqual([
      'cut-a-while.showPanel',
      'cut-a-while.toggle',
      'cut-a-while.reset',
      'cut-a-while.stats',
    ])
  })
})
