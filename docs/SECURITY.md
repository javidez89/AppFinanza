# Seguridad

- El navegador solo recibe `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Nunca guardar `service_role`, secret keys, CVV, PIN o números completos de tarjetas.
- Todas las filas financieras se limitan por `workspace_members` mediante RLS.
- La membresía se valida en base de datos; el frontend solo refleja esa decisión.
- Antes de producción: configurar Google OAuth, revisar redirect URLs, rotar credenciales si fueron expuestas y ejecutar Security Advisors.
- En GitHub Actions, URL y publishable key se guardan como **Repository variables**; las secret keys no se cargan ni se usan para compilar el frontend.
