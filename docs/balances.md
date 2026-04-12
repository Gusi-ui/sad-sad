# Balances (Admin) — verificación manual

Rutas:
- `/admin/balances`
- `/admin/balances/users`
- `/admin/balances/users/:userId`
- `/admin/balances/workers`
- `/admin/balances/workers/:workerId`

## Qué se calcula

### Usuarios/as
- **Cuota mensual**: `service_users.monthly_hours_quota` (horas).
- **Planificado (mes completo / previsión)**:
  - Si existen `assignments` en un día, se suman (duración `planned_end - planned_start`).
  - Si NO existen `assignments` en un día, se usa la suma teórica de `service_templates` para ese día (según laborable/festivo/fin de semana).
- **Delta**: `planificado - cuota`.
- **Semanal**: agrupación por semana ISO (UTC) a partir de cada día del mes.
- **Diario**: listado de todos los días del mes (incluye días sin servicio con 0h).
- **Festivo vs fin de semana**: si el día está en tabla `holidays` (scope nacional/catalonia/barcelona/mataro) se marca como **Festivo**, aunque caiga en sábado/domingo.

### Trabajadoras
- **Contrato semanal/mensual**: del contrato vigente ese mes (`worker_contracts`) por fechas (`start_date`, `end_date`).
- **Planificado**: suma de duraciones de `assignments` del mes para `assigned_worker_id` con `status != 'cancelled'`.
- **Descanso**: +20 min por cada día que tenga al menos un servicio (día con minutos > 0).
- **Desplazamiento**: minutos configurables por admin en `worker_day_extras.travel_minutes` (por día).
- **Total a pagar**: `servicios + descanso + desplazamiento`.
- **Delta mes**: `total_a_pagar - contrato_mensual` (solo si `hours_per_month` está definido en contrato).
- **Promedio semanal**: `total_a_pagar_mes / número_de_semanas_ISO_del_mes`.
- **Diario**: listado de todos los días del mes, indicando usuarios atendidos.

## Checklist de verificación rápida

1) Elige un mes (ej. el actual) con pocos servicios y calcula a mano:
   - selecciona un usuario y suma duraciones de sus servicios del mes.
   - compara con “Horas planificadas” en `/admin/balances/users/:userId`.

2) Verifica festivos:
   - crea/usa un festivo en el mes (tabla `holidays`).
   - comprueba que el día aparece como **Festivo** en el detalle diario.

3) Verifica exclusión de cancelados:
   - marca un assignment como `cancelled` y confirma que deja de sumar.

4) Verifica trabajadoras:
   - selecciona una trabajadora con 2–3 asignaciones en el mes y suma duraciones.
   - añade 20 min por día con servicio y comprueba el “Total a pagar”.
   - añade minutos de desplazamiento en el detalle diario (columna “Desplaz.”) y comprueba que suma.
   - si tiene `hours_per_month` en contrato, valida el delta.
