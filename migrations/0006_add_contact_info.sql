PRAGMA foreign_keys = ON;

-- Añadir dirección y teléfono a la trabajadora
ALTER TABLE workers ADD COLUMN address TEXT;
ALTER TABLE workers ADD COLUMN phone TEXT;

-- Añadir teléfono al usuario (la dirección ya existía)
ALTER TABLE service_users ADD COLUMN phone TEXT;
