import * as React from 'react'

export type ShortcutDef = {
  key: string // e.key value, case-insensitive
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  handler: () => void
}

/**
 * Register keyboard shortcuts on window.
 * Modifier combos (Ctrl/Alt) always fire even when an input is focused.
 * Bare key presses are blocked when inside INPUT / TEXTAREA / SELECT.
 * Listener is added once and reads latest shortcuts via ref to avoid
 * re-registering on every render.
 */
export function useShortcut(shortcuts: ShortcutDef[]): void {
  const ref = React.useRef(shortcuts)
  React.useLayoutEffect(() => {
    ref.current = shortcuts
  })

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement).tagName
      )
      const isModifierCombo = e.ctrlKey || e.altKey || e.metaKey
      if (isInput && !isModifierCombo) return

      for (const s of ref.current) {
        if (
          e.key.toLowerCase() === s.key.toLowerCase() &&
          !!s.ctrl === e.ctrlKey &&
          !!s.shift === e.shiftKey &&
          !!s.alt === e.altKey
        ) {
          e.preventDefault()
          s.handler()
          return
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, []) // empty — listener added once, reads latest via ref
}
