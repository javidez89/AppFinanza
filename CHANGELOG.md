# Registro de cambios

Las versiones en preparación no se han publicado. El estado del despliegue y la release se verifica en GitHub.

## [Sin publicar]

## [0.2.0] - En preparación

### Añadido

- Interés total aplicado una sola vez al capital del préstamo, disponible y predeterminado en el formulario de préstamos nuevos.
- Reparto de capital e interés por cuotas con conservación de sus totales en centavos; etiquetas para distinguir la modalidad guardada.
- Validación de fechas, importes y número de cuotas en la función utilizada por el formulario.
- Política de versionamiento, instrucciones persistentes y plantilla de PR.

### Corregido

- Vencimientos mensuales de fin de mes, sin saltar febrero.
- Conversión de tasas para pagos cada 14 días usando 26 períodos convencionales por año; se aclara esa frecuencia en el formulario.

### Validación y despliegue

- 34 pruebas unitarias; lint, typecheck y build de Pages correctos. Migración comprobada en PostgreSQL aislado. CI incluye una prueba SQL sobre PostgreSQL 17.
- Aplicar `20261007201853_loan_total_interest.sql` antes de publicar el formulario. No se modifican préstamos ni cronogramas ya registrados.
- No incluye los cambios PWA del PR #2, que continúan en una rama independiente.

## [0.1.0] - Base del repositorio

Versión declarada antes de adoptar esta política. Esta entrada identifica la base y no afirma que exista una release o un tag histórico.
