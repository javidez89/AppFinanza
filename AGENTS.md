# Desarrollo de AppFinanza

- Para cada ajuste, seguir `docs/VERSIONING.md` y registrar el cambio en `CHANGELOG.md`.
- Trabajar en una rama separada desde el estado más reciente de `master`; integrar mediante PR y revisar el orden de integración de las ramas concurrentes.
- Cada PR que cambie el producto debe proponer una versión mayor que la versión actual de `master`, con `package.json`, `package-lock.json` y changelog sincronizados. Los commits adicionales del mismo PR mantienen la versión propuesta mientras no se haya publicado.
- Usar commits convencionales. No sobrescribir versiones, tags, migraciones ya aplicadas ni historial compartido.
- Ejecutar las validaciones apropiadas y documentar resultados, cambios de base de datos, orden de despliegue y limitaciones en el PR.
- No describir una versión preparada en una rama como publicada. Crear el tag y la release únicamente sobre el commit integrado y desplegado correctamente.
- Conservar las reglas financieras de `docs/FINANCIAL_RULES.md`; no reinterpretar ni recalcular registros financieros existentes sin una instrucción explícita.
