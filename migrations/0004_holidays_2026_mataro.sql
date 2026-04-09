-- Festivos 2026 (ámbito Mataró / Cataluña / España) para cálculo de días laborables vs festivo.
-- Un mismo día puede figurar en un solo scope; la app une todos los scopes configurados.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO holidays (id, date, name, scope, year) VALUES
  ('2026-01-01-national', '2026-01-01', 'Año Nuevo', 'national', 2026),
  ('2026-01-06-national', '2026-01-06', 'Reyes', 'national', 2026),
  ('2026-04-03-national', '2026-04-03', 'Viernes Santo', 'national', 2026),
  ('2026-04-06-catalonia', '2026-04-06', 'Lunes de Pascua', 'catalonia', 2026),
  ('2026-05-01-national', '2026-05-01', 'Día del trabajador', 'national', 2026),
  ('2026-05-25-mataro', '2026-05-25', 'Feria de Mataró', 'mataro', 2026),
  ('2026-06-24-catalonia', '2026-06-24', 'Sant Joan', 'catalonia', 2026),
  ('2026-07-27-mataro', '2026-07-27', 'Fiesta mayor de Les Santes', 'mataro', 2026),
  ('2026-08-15-national', '2026-08-15', 'La Asunción', 'national', 2026),
  ('2026-09-11-catalonia', '2026-09-11', 'Diada Nacional de Cataluña', 'catalonia', 2026),
  ('2026-10-12-national', '2026-10-12', 'Fiesta Nacional de España', 'national', 2026),
  ('2026-12-08-national', '2026-12-08', 'La Inmaculada', 'national', 2026),
  ('2026-12-25-national', '2026-12-25', 'Navidad', 'national', 2026),
  ('2026-12-26-catalonia', '2026-12-26', 'San Esteban', 'catalonia', 2026);
