# AppFinanza

Aplicación web/PWA de administración financiera personal y familiar.

## Desarrollo

1. Copia `.env.example` a `.env.local` y completa únicamente la URL pública y publishable key de Supabase.
2. Ejecuta `npm ci`.
3. Ejecuta `npm run dev`.

Comandos de calidad: `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`.

## Despliegue

El frontend se exporta como contenido estático en `out/`. El flujo de `.github/workflows/deploy-pages.yml` valida el código y publica esa carpeta desde `master` en `https://javidez89.github.io/AppFinanza/`.

Para activar el despliegue:

1. En GitHub, **Settings → Pages → Build and deployment**, selecciona **GitHub Actions**.
2. En **Settings → Secrets and variables → Actions → Variables**, crea `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` del proyecto Supabase `AppFinanza`. Son valores públicos; nunca uses `service_role`.
3. En Supabase **Authentication → URL Configuration**, establece **Site URL** en `https://javidez89.github.io/AppFinanza/` y agrega `https://javidez89.github.io/AppFinanza/auth/callback/` a **Redirect URLs**. En Google Cloud, el URI autorizado de redirección debe ser el callback de Supabase (`https://<project-ref>.supabase.co/auth/v1/callback`), no la URL de Pages.
4. Reanuda el proyecto Supabase `AppFinanza` si está inactivo y confirma que Google OAuth y las políticas RLS están configurados. La aplicación no podrá iniciar sesión ni consultar datos mientras el proyecto esté inactivo.
5. Publica los cambios en `master`. El flujo se ejecutará automáticamente.

El build de Pages usa `NEXT_PUBLIC_BASE_PATH=/AppFinanza`. Para probar esa misma estructura localmente, configura esa variable antes de `npm run build`; para `npm run dev`, déjala vacía. Consulta `docs/SECURITY.md` y `docs/DATABASE.md` para el acceso a datos.
