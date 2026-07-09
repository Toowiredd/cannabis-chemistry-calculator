/**
 * useModalA11y — one-stop modal accessibility wiring.
 *
 * Provides four things every modal in this app needs:
 *   1. Escape closes the modal (via the supplied onClose).
 *   2. Body scroll lock while the modal is open.
 *   3. Focus trap — Tab/Shift+Tab cycle inside the modal panel.
 *   4. Initial focus on open + focus return on close.
 *
 * The hook returns a ref the consumer attaches to the modal PANEL
 * (the dialog element, not the backdrop). The backdrop can stay a
 * passive overlay with `role="presentation"`.
 *
 * Reduced-motion / scroll lock is preserved across the open/close
 * cycle: the previous `document.body.style.overflow` is restored
 * cleanly on close.
 */
import { useEffect, useRef, type MutableRefObject } from 'react'

export function useModalA11y(
  open: boolean,
  onClose: () => void,
  options: { closeOnEscape?: boolean } = {}
): MutableRefObject<HTMLDivElement | null> {
  const { closeOnEscape = true } = options
  const modalRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  // Capture the trigger element on open so we can return focus on close.
  useEffect(() => {
    if (open) {
      triggerRef.current = (document.activeElement as HTMLElement) ?? null
    } else if (triggerRef.current) {
      triggerRef.current.focus()
      triggerRef.current = null
    }
  }, [open])

  // Lock body scroll while the modal is open so the underlying page
  // cannot scroll behind it.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Escape closes the modal; Tab/Shift+Tab cycle inside the panel.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !modalRef.current) return
      const focusables = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('aria-hidden'))
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, closeOnEscape])

  // Move initial focus into the modal panel so keyboard users land
  // somewhere sensible. Prefer the first focusable element.
  useEffect(() => {
    if (!open || !modalRef.current) return
    const focusables = modalRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    ;(focusables[0] as HTMLElement | undefined)?.focus()
  }, [open])

  return modalRef
}