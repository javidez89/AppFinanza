# AppFinanza

Aplicación web/PWA de administración financiera personal y familiar.

## Desarrollo

1. Copia `.env.example` a `.env.local` y completa únicamente la URL pública y publishable key de Supabase.
2. Ejecuta `npm install`.
3. Ejecuta `npm run dev`.

Comandos de calidad: `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`.

## Despliegue

El frontend se exporta como contenido estático en `out/` para GitHub Pages. En **Settings → Secrets and variables → Actions → Variables**, crea `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Supabase administra Auth y PostgreSQL. Consulta `docs/SECURITY.md`, `docs/DATABASE.md` y `docs/IMPLEMENTATION_PLAN.md` antes de configurar producción.
