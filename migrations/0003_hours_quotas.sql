PRAGMA foreign_keys = ON;

-- Cuota mensual aprobada por el ayuntamiento (horas objetivo del usuario del servicio)
ALTER TABLE service_users ADD COLUMN monthly_hours_quota REAL;

-- Contrato: horas mensuales opcionales (además de hours_per_week)
ALTER TABLE worker_contracts ADD COLUMN hours_per_month REAL;
