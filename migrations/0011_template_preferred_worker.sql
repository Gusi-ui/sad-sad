-- Step 1: Add preferred_worker_id to service_templates
ALTER TABLE service_templates ADD COLUMN preferred_worker_id TEXT REFERENCES workers(id) ON DELETE SET NULL;

-- Step 2: Migrate data from service_users to service_templates
-- If template kind is 'weekend', use preferred_weekend_worker_id. Otherwise use preferred_worker_id.
UPDATE service_templates
SET preferred_worker_id = (
    SELECT CASE 
        WHEN service_templates.kind = 'weekend' THEN service_users.preferred_weekend_worker_id
        ELSE service_users.preferred_worker_id
    END
    FROM service_users
    WHERE service_users.id = service_templates.service_user_id
);

-- Step 3: Remove preferred_worker_id and preferred_weekend_worker_id from service_users
ALTER TABLE service_users DROP COLUMN preferred_worker_id;
ALTER TABLE service_users DROP COLUMN preferred_weekend_worker_id;