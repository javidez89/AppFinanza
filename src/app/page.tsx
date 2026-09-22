"use client";

import { useEffect } from "react";
import { appPath } from "@/lib/app-path";
import { ALLOWED_EMAILS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  useEffect(() => {
    void (async () => {
      try {
        const { data: { user } } = await createClient().auth.getUser();
        const allowed = user?.email && ALLOWED_EMAILS.includes(user.email.toLowerCase() as (typeof ALLOWED_EMAILS)[number]);
        window.location.replace(appPath(allowed ? "/dashboard/" : "/login/"));
      } catch {
        window.location.replace(appPath("/login/"));
      }
    })();
  }, []);
  return <main className="loading-page" aria-live="polite">Preparando AppFinanza…</main>;
}
