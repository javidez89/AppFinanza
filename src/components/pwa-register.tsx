'use client'

import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const basePath = window.location.pathname.startsWith('/AppFinanza/') ? '/AppFinanza' : ''
      navigator.serviceWorker.register(`${basePath}/sw.js`, { scope: `${basePath}/` }).catch(() => undefined)
    }
  }, [])
  return null
}
