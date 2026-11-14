"use client";

import { useEffect } from "react";
import { appPath } from "@/lib/app-path";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("AppFinanza client error", error);
  }, [error]);

  return <main className="loading-page" role="alert">
    <div className="panel" style={{ maxWidth: 520, margin: "48px auto", padding: 28, textAlign: "center" }}>
      <h1 style={{ marginTop: 0 }}>No se pudo abrir esta sección</h1>
      <p className="sub">La información no se ha modificado. Intenta recargar la aplicación.</p>
      <div className="top-actions" style={{ justifyContent: "center", marginTop: 20 }}>
        <button className="button primary" onClick={reset}>Reintentar</button>
        <a className="button secondary" href={appPath("/login/")}>Ir al inicio de sesión</a>
      </div>
    </div>
  </main>;
}
