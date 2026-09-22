'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ALLOWED_EMAILS } from '@/lib/constants'
import { appPath } from '@/lib/app-path'

export function LoginCard({ error }: { error?: string }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(error ?? '')

  async function signInWithGoogle() {
    setLoading(true)
    setMessage('')
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${appPath('/auth/callback/')}`,
      },
    })
    if (authError) {
      setMessage(authError.message)
      setLoading(false)
    }
  }

  return (
    <div className="login-card">
      <div className="brand-mark" aria-hidden="true">MG</div>
      <p className="eyebrow">FINANZAS PERSONALES COMPARTIDAS</p>
      <h1>Mi Gerencia Financiera</h1>
      <p className="login-copy">
        Ingresos, gastos, préstamos e inversiones en una sola vista sencilla y gerencial.
      </p>

      <button className="google-button" onClick={signInWithGoogle} disabled={loading}>
        <span className="google-g">G</span>
        {loading ? 'Conectando…' : 'Continuar con Google'}
      </button>

      {message ? <div className="notice error">{message}</div> : null}

      <div className="allowed-box">
        <span>Acceso autorizado únicamente para:</span>
        {ALLOWED_EMAILS.map((email) => <strong key={email}>{email}</strong>)}
      </div>

      <p className="privacy-note">Tus movimientos quedan protegidos por inicio de sesión y reglas de acceso en la base de datos.</p>
    </div>
  )
}
