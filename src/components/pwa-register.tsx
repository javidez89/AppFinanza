"use client";

import { useEffect, useState } from "react";
import { appPath } from "@/lib/app-path";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaRegister() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(true);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const syncDisplay = () => setInstalled(standalone.matches);
    syncDisplay();
    standalone.addEventListener("change", syncDisplay);
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    const checkWaiting = () => {
      if (!disposed && registration?.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting);
    };
    const onUpdate = () => {
      installing?.removeEventListener("statechange", checkWaiting);
      installing = registration?.installing ?? null;
      installing?.addEventListener("statechange", checkWaiting);
    };
    let controlled = Boolean(navigator.serviceWorker?.controller);
    const onController = () => {
      if (controlled) window.location.reload();
      controlled = true;
    };
    if ("serviceWorker" in navigator && window.isSecureContext && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.addEventListener("controllerchange", onController);
      void navigator.serviceWorker.register(appPath("/sw.js"), {
        scope: appPath("/"), updateViaCache: "none",
      }).then((result) => {
        if (disposed) return;
        registration = result;
        checkWaiting();
        registration.addEventListener("updatefound", onUpdate);
        onUpdate();
      }).catch(() => {
        if (!disposed) setMessage("No se pudo preparar la app para uso sin conexión. Recarga para reintentar.");
      });
    }
    return () => {
      disposed = true;
      standalone.removeEventListener("change", syncDisplay);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      navigator.serviceWorker?.removeEventListener("controllerchange", onController);
      registration?.removeEventListener("updatefound", onUpdate);
      installing?.removeEventListener("statechange", checkWaiting);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    setPrompt(null); // Each browser event can only be used once.
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setMessage(choice.outcome === "accepted" ? "Instalación solicitada. Sigue las indicaciones del navegador." : "Puedes instalar la app más tarde desde el menú del navegador.");
    } catch {
      setMessage("Abre el menú del navegador para instalar AppFinanza.");
    }
  }

  if (installed && !waiting && !message) return null;
  return <aside className="pwa-panel" aria-label="Instalación de AppFinanza">
    {!installed && <details>
      <summary>Instalar AppFinanza</summary>
      <p>Windows: abre esta página en Edge o Chrome y usa el icono de instalación de la barra de direcciones o la opción de instalar del menú.</p>
      <p>Android: abre esta página en Chrome y elige «Instalar aplicación» o «Añadir a pantalla de inicio» en el menú. Si estás en otra app, abre el enlace en Chrome.</p>
      <p>Necesitas internet para acceder a tus finanzas.</p>
    </details>}
    {!installed && prompt && <button onClick={install}>Instalar ahora</button>}
    {waiting && <div><p>Hay una nueva versión disponible. Guarda los cambios antes de actualizar.</p><button onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}>Actualizar app</button></div>}
    {message && <p role="status">{message}</p>}
  </aside>;
}
