'use client'

import { useEffect } from 'react'
import { appPath } from '@/lib/app-path'

export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(appPath('/sw.js'), { scope: appPath('/') }).catch(() => undefined)
    }
  }, [])
  return null
}
