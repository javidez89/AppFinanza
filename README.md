# AppFinanza

Aplicación web/PWA de administración financiera personal y familiar.

## Desarrollo

1. Copia `.env.example` a `.env.local` y completa únicamente la URL pública y publishable key de Supabase.
2. Ejecuta `npm ci`.
3. Ejecuta `npm run dev`.

Comandos de calidad: `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`.

Cada ajuste sigue la [política de versionamiento](docs/VERSIONING.md) y se registra en [CHANGELOG.md](CHANGELOG.md). Ejecuta también `npm run version:check` para comprobar que la versión y sus registros coinciden.

## Despliegue

El frontend se exporta como contenido estático en `out/`. El flujo de `.github/workflows/deploy-pages.yml` valida el código y publica esa carpeta desde `master` en `https://javidez89.github.io/AppFinanza/`.

Configuración de producción:

1. En GitHub, **Settings → Pages → Build and deployment**, está seleccionado **GitHub Actions**. El flujo de despliegue ya se ejecutó correctamente.
2. Las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` están configuradas en **Settings → Secrets and variables → Actions → Variables**. Son valores públicos; nunca uses `service_role`.
3. En Supabase **Authentication → URL Configuration**, la **Site URL** ya es `https://javidez89.github.io/AppFinanza/` y está autorizada `https://javidez89.github.io/AppFinanza/auth/callback/`.
4. **Pendiente:** configura un cliente OAuth web en Google Cloud con URI de retorno `https://kmtkeigmjyldkxywxnpz.supabase.co/auth/v1/callback`. Copia su Client ID y Client Secret en Supabase **Authentication → Sign In / Providers → Google** y activa el proveedor. Nunca incluyas el Client Secret en el repositorio ni en variables `NEXT_PUBLIC_`.
5. La migración inicial ya se aplicó a Supabase `AppFinanza`; las 14 tablas tienen RLS activo. Prueba el acceso con los dos correos autorizados cuando Google OAuth esté habilitado.
6. Cada publicación en `master` ejecutará el flujo automáticamente.

El build de Pages usa `NEXT_PUBLIC_BASE_PATH=/AppFinanza`. Para probar esa misma estructura localmente, configura esa variable antes de `npm run build`; para `npm run dev`, déjala vacía. Consulta `docs/SECURITY.md` y `docs/DATABASE.md` para el acceso a datos.
