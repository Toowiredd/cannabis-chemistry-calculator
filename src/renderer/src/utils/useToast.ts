import { useState, useCallback, useEffect } from 'react'

export function useToast(duration = 2000) {
  const [message, setMessage] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  const show = useCallback(
    (msg: string) => {
      setMessage(msg)
      setVisible(true)
    },
    [setMessage, setVisible]
  )

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(() => {
      setVisible(false)
    }, duration)
    return () => clearTimeout(timer)
  }, [visible, duration])

  return { message, visible, show }
}
