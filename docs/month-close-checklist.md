# Checklist de cierre de mes (Admin)

## 1) Datos base (antes de revisar horas)
- Festivos: confirma que el año/mes tiene los festivos correctos para el ámbito operativo (Nacional + Cataluña + Mataró) en /admin/holidays.
- Usuarios/as activos: revisa que los usuarios/as a prestar servicio están activos y con dirección/teléfono correctos.
- Trabajadoras activas: revisa que la trabajadora está activa y con su tipo correcto (laborable / festivo / ambos).

## 2) Plantillas y previsión (para “ver el mes entero”)
- Plantillas por usuario/a: valida horarios, tipo (laborable/festivo) y día de la semana.
- Trabajadora preferida: asigna la trabajadora habitual como preferida en las plantillas para que las previsiones mensuales se completen aunque aún no existan assignments.
- Sustituciones: si un usuario/a tiene sustitución, crea/ajusta assignments reales en la semana correspondiente (no relies en la plantilla).

## 3) Agenda (operativa semanal)
- Agenda semanal: entra en /admin/schedule/week y revisa semana a semana.
- Regenerar semana: úsalo cuando cambies plantillas y quieras materializar los servicios reales en assignments.
- Asignaciones: asegúrate de que los servicios clave quedan asignados a la trabajadora correcta y sin solapes.

## 4) Desplazamientos
- Plantilla semanal de desplazamientos (Lun–Dom): define un patrón estable en el balance de la trabajadora.
- Aplicar plantilla por semana: aplica la plantilla en el “Resumen semanal (ISO)” para rellenar el mes sin ir día a día.
- Ajustes puntuales: corrige días concretos en “Detalle diario” si hay sustitución o cambio operativo.

## 5) Balance de trabajadora (mes natural)
- Contrato vigente: confirma contrato semanal y (si existe) mensual; si no existe mensual, se deriva de h/semana.
- Horas planificadas (a pagar): valida el total del mes (servicios + descansos + desplazamientos).
- Descansos: revisa que los días laborables con ≥ 6h de servicios sumen 20 min.
- Delta mes: comprueba la diferencia del mes frente al contrato mensual efectivo.
- Semanas ISO: revisa el “Promedio semanal (ISO)” para detectar desbalances por semanas incompletas.

## 6) Cierre operativo
- Días sin servicio: revisa días laborables sin planificación cuando debería haberla.
- Servicios huérfanos: en el usuario/a, limpia servicios antiguos sin plantilla si aplica.
- Comunicaciones: si se han hecho cambios relevantes, revisa que el equipo tenga la planificación actualizada.

## 7) Control final (antes de facturación)
- Validación cruzada: contrasta la previsión mensual (mes) con la ejecución semanal (semanas) para detectar huecos.
- Ajustes finales: aplica correcciones en assignments (real) y en desplazamientos del mes.
- Captura/registro: guarda un resumen del balance (horas a pagar, descansos, desplazamientos y delta) para auditoría interna.
