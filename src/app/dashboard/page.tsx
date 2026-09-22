"use client";

import { useEffect, useState } from "react";
import { DashboardClient } from "@/components/dashboard-client";
import { appPath } from "@/lib/app-path";
import { ALLOWED_EMAILS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

type SessionUser = { email: string; name: string } | null;

export default function DashboardPage() {
  const [user, setUser] = useState<SessionUser>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void (async () => {
      try {
        const { data: { user: currentUser } } = await createClient().auth.getUser();
        const email = currentUser?.email?.toLowerCase();
        if (!email || !ALLOWED_EMAILS.includes(email as (typeof ALLOWED_EMAILS)[number])) {
          window.location.replace(appPath("/login/"));
          return;
        }
        setUser({ email, name: currentUser?.user_metadata?.full_name ?? email.split("@")[0] });
      } catch {
        window.location.replace(appPath("/login/"));
      } finally {
        setReady(true);
      }
    })();
  }, []);
  if (!ready || !user) return <main className="loading-page" aria-live="polite">Verificando acceso…</main>;
  return <DashboardClient email={user.email} name={user.name} />;
}
