# Arquitectura

AppFinanza es una aplicación Next.js estática para GitHub Pages. React presenta la interfaz; Supabase provee Auth, Data API y PostgreSQL. La carpeta `src/lib/finance` contiene reglas financieras puras y `src/lib/supabase` contiene acceso al backend.

El ledger central será la fuente de verdad para saldos, patrimonio y operaciones. Las operaciones que cambien más de una entidad deben ejecutarse atómicamente en PostgreSQL mediante RPC.
