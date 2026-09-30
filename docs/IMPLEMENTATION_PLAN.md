# AppFinanza — plan de implementación

## Estado inicial

El repositorio estaba vacío: no existían aplicación, dependencias, configuración Next.js, integración Supabase, pruebas, documentación ni CI. No había código funcional que preservar.

## Implementado en esta fase

- Base Next.js + TypeScript con `output: "export"`, `trailingSlash` y soporte para `/AppFinanza` en GitHub Pages.
- Dashboard responsive en español con cuentas, movimientos, préstamos, CDT, tarjetas, deudas, presupuestos, metas, alertas y reportes.
- Cliente Supabase únicamente con URL y publishable key públicas; no se agregan secretos.
- Login de Google y callback implementados enteramente en el navegador para ser compatibles con GitHub Pages.
- PWA con manifest, iconos, service worker limitado a recursos estáticos y botón de instalación en el dashboard.
- Motor financiero aislado para amortización, CDT, patrimonio y transferencias, con pruebas unitarias.
- Migración con allowlist, perfiles, espacio de trabajo compartido, membresías, RLS, permisos explícitos y auditoría.

## Problemas y deuda técnica

- Google OAuth necesita un Client ID y Client Secret válidos en Supabase; el proveedor continúa deshabilitado hasta entonces.
- Las operaciones de negocio del cliente importado aún deben migrarse progresivamente a RPC atómicas para préstamos, redenciones, pagos de tarjeta/deuda y transferencias.
- Falta probar el flujo completo con los dos usuarios autorizados, conexión lenta y datos reales.
- Las variables públicas del repositorio, GitHub Pages, la migración y las URL de redirección ya están configuradas. Security Advisor no reportó hallazgos.

## Fases siguientes

1. Configurar Google OAuth con un cliente web de Google Cloud y probar el retorno a Pages.
2. Probar el acceso de los dos usuarios autorizados, RLS e instalación PWA.
4. Migrar operaciones financieras críticas a RPC atómicas y agregar pruebas de integración de RLS.
5. Realizar QA de permisos, errores, accesibilidad, responsive y datos reales.

## Decisiones

GitHub Pages obliga a exportación estática; por eso no se usan Server Actions, middleware de servidor ni rutas API de Next.js. Supabase es el backend y cualquier operación crítica deberá vivir en RPC PostgreSQL o una Edge Function estrictamente necesaria.
