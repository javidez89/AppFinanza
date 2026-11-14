"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("AppFinanza critical client error", error);
  }, [error]);

  return <html lang="es-CO"><body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f6f8fa", color: "#12324a" }}>
    <main style={{ maxWidth: 520, margin: "72px auto", padding: 28, textAlign: "center", background: "white", borderRadius: 16, boxShadow: "0 8px 28px rgba(18,50,74,.12)" }} role="alert">
      <h1>AppFinanza necesita recargarse</h1>
      <p>Tu información no se ha modificado. Presiona el botón para cargar la versión actual.</p>
      <button type="button" onClick={reset} style={{ border: 0, borderRadius: 8, padding: "12px 18px", background: "#12324a", color: "white", fontWeight: 700, cursor: "pointer" }}>Recargar AppFinanza</button>
    </main>
  </body></html>;
}
