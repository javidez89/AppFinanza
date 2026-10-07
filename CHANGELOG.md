# Registro de cambios

Las versiones en preparación no se han publicado. El estado del despliegue y la release se verifica en GitHub.

## [Sin publicar]

## [0.3.1] - 2026-10-07

### Corregido

- Caja de mamá muestra todos los movimientos que participan en su saldo, incluidos gastos, préstamos, inversiones y sus cobros; utiliza la misma selección de movimientos que el cálculo del saldo.
- La tabla presenta descripción y notas para identificar cada entrada/salida. El resumen indica el saldo inicial y explica los movimientos incluidos.

### Validación y despliegue

- Prueba de regresión del saldo reportado: las siete operaciones visibles explican -$29.750.000; pruebas de aislamiento entre cuentas y movimientos sin efecto en efectivo.
- Corrección de visualización y selección de filas; no modifica ni reclasifica registros existentes y no requiere migración de base de datos.

## [0.3.0] - 2026-10-07

### Añadido

- Instalación PWA guiada en Windows y Android, con botón nativo cuando el navegador lo admite e instrucciones alternativas.
- Identidad estable del manifest, iconos para uso normal y maskable, metadata e icono Apple.
- Página pública sin conexión y aviso para aceptar una actualización antes de recargar.
- Validación automática de la exportación PWA y CI para la raíz y `/AppFinanza`.

### Corregido

- Caché del service worker limitada al alcance de la app, renovada por versión del contenido y sin guardar páginas autenticadas ni respuestas financieras.

### Despliegue

- Conserva la modalidad de interés total y el versionamiento de 0.2.0. La migración de préstamos ya aplicada se mantiene sin nuevos cambios de base de datos.
- Los diálogos de instalación de Windows/Android y el inicio de sesión deben comprobarse en los dispositivos y cuentas correspondientes; la página sin conexión no permite operar las finanzas.

## [0.2.0] - 2026-10-07

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
- Aplicar `20261007204216_loan_total_interest.sql` antes de publicar el formulario. No se modifican préstamos ni cronogramas ya registrados.
- Esta versión no incluye los cambios PWA del PR #2; se incorporan en 0.3.0.

## [0.1.0] - Base del repositorio

Versión declarada antes de adoptar esta política. Esta entrada identifica la base y no afirma que exista una release o un tag histórico.
