# Base de datos

El modelo usa `workspace_id` en las tablas de negocio. `profiles`, `workspaces` y `workspace_members` separan identidad de autorización. Todas las tablas expuestas deben tener RLS habilitado y políticas basadas en membresía, nunca en correo enviado por el navegador ni `user_metadata`.

Los valores monetarios son `numeric`; los estados usan checks o enums. La migración inicial está en `supabase/migrations/20260930040540_0001_initial.sql` y se aplicó al proyecto AppFinanza.
