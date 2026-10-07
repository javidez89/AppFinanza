# Reglas financieras

- Transferencias no son ingreso ni gasto.
- Préstamo realizado: disminuye caja y aumenta cartera; capital recibido no es gasto e intereses recibidos sí son ingreso financiero.
- CDT: aporte mueve caja a inversión; redención separa capital y rendimiento, y solo el rendimiento es ingreso.
- Compra con tarjeta: registra gasto y aumenta pasivo. Pago de tarjeta disminuye caja y pasivo, sin segundo gasto.
- Préstamo recibido: aumenta caja y deuda; el capital pagado reduce deuda y solo los intereses son gasto financiero.
- Patrimonio = activos − pasivos.

## Interés de préstamos

- `total`: porcentaje aplicado una sola vez al capital original. Interés = capital × porcentaje / 100; total a cobrar = capital + interés. Capital e interés se distribuyen entre las cuotas, con ajustes de centavos que conservan ambos totales. Es la modalidad predeterminada para préstamos nuevos.
- Ejemplo: $50.000.000, 20 % total y 48 cuotas generan $10.000.000 de interés, $60.000.000 por cobrar y cuotas de $1.250.000.
- `monthly` y `annual_effective`: mantienen la amortización de cuota fija sobre saldo pendiente. Seleccionar esas modalidades explícitamente para acuerdos con tasa periódica.
- Mensual usa meses calendario, conservando el día original y limitándolo al último día del mes cuando sea necesario. `biweekly` significa cada 14 días (26 períodos convencionales por año); `weekly`, cada 7 días (52 períodos).
- En la modalidad total, cambiar fechas, periodicidad o número de cuotas no aumenta el interés acordado. No se generan cargos adicionales por aplazar la primera cuota. Las modalidades sobre saldo tampoco calculan automáticamente interés por períodos de gracia; ese acuerdo requiere soporte específico.
- No se recalculan ni convierten préstamos existentes. Si un préstamo se registró con la modalidad incorrecta, revisar su acuerdo y los pagos antes de corregirlo.

Antes de desplegar el frontend con esta modalidad, aplicar la migración `20261007201853_loan_total_interest.sql` en Supabase. Amplía únicamente el CHECK de `interest_rate_type`; conserva los registros, permisos y políticas existentes. Las pruebas SQL de `tests/db/` se ejecutan exclusivamente en una base desechable, nunca en producción.
