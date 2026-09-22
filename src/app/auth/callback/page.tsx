"use client";

import { useEffect, useState } from "react";
import { appPath } from "@/lib/app-path";
import { ALLOWED_EMAILS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Completando inicio de sesión…");
  useEffect(() => {
    void (async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) { window.location.replace(appPath("/login/?error=No%20se%20recibi%C3%B3%20el%20c%C3%B3digo%20de%20Google.")); return; }
      try {
        const client = createClient();
        const { data, error } = await client.auth.exchangeCodeForSession(code);
        const email = data.user?.email?.toLowerCase();
        if (error || !email || !ALLOWED_EMAILS.includes(email as (typeof ALLOWED_EMAILS)[number])) {
          await client.auth.signOut();
          window.location.replace(appPath("/login/?error=Acceso%20no%20autorizado."));
          return;
        }
        window.location.replace(appPath("/dashboard/"));
      } catch {
        setMessage("No se pudo iniciar sesión. Inténtalo de nuevo.");
      }
    })();
  }, []);
  return <main className="loading-page" aria-live="polite">{message}</main>;
}
