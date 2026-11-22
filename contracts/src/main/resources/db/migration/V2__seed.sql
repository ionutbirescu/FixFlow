-- Demo data: one technician, one manager and five machines with maintenance history.
-- The IDs are fixed so tests, MSW mocks and demo scripts can refer to them.

-- Both logins use the password "fixflow" (BCrypt, cost 10).
INSERT INTO users (id, username, password_hash, role) VALUES
    ('00000000-0000-4000-8000-000000000001', 'tech1',    '$2a$10$sBX8gEVilCmAI8aBI2KpougggvbYJ4fqtHYVYmJoNFRFwhRcCfrQe', 'TECHNICIAN'),
    ('00000000-0000-4000-8000-000000000002', 'manager1', '$2a$10$tw9YMezCmZkq0b5aAlL.vOVnR3IgosgomjWw1EUGgla/PUllQwIcW', 'MANAGER');

INSERT INTO machines (id, name, model, location, installed_at, service_interval_days) VALUES
    ('00000000-0000-4000-8000-000000000101', 'CNC Lathe 01',       'Haas ST-10',         'Hall A',          DATE '2021-03-10', 90),
    ('00000000-0000-4000-8000-000000000102', 'Hydraulic Press 02', 'HPX-250',            'Hall A',          DATE '2019-09-02', 60),
    ('00000000-0000-4000-8000-000000000103', 'Conveyor Belt 03',   'Dorner 3200',        'Hall B',          DATE '2022-06-15', 30),
    ('00000000-0000-4000-8000-000000000104', 'Air Compressor 04',  'Atlas Copco GA 30',  'Compressor room', DATE '2020-01-20', 180),
    ('00000000-0000-4000-8000-000000000105', 'Welding Robot 05',   'KUKA KR 16',         'Hall B',          DATE '2024-05-20', 365);

-- History is dated relative to the day this migration runs (09:00 UTC, `days_ago` days earlier),
-- so the schedule always looks the same in a demo. Counting from the last PREVENTIVE service:
--   Hydraulic Press 02 is 70 days overdue (and has a recurring oil leak),
--   Conveyor Belt 03 is due in 3 days and Air Compressor 04 in 8 days,
--   CNC Lathe 01 is due in 25 days and Welding Robot 05 in 35 days.
INSERT INTO maintenance_events (machine_id, performed_at, type, description, performed_by)
SELECT e.machine_id::uuid,
       ((CURRENT_DATE - e.days_ago) + TIME '09:00') AT TIME ZONE 'UTC',
       e.type,
       e.description,
       e.performed_by
FROM (VALUES
    -- CNC Lathe 01, every 90 days
    ('00000000-0000-4000-8000-000000000101', 425, 'PREVENTIVE', 'Quarterly service: way lube and coolant changed, chip conveyor cleaned', 'tech1'),
    ('00000000-0000-4000-8000-000000000101', 335, 'PREVENTIVE', 'Quarterly service: way lube and coolant changed', 'tech1'),
    ('00000000-0000-4000-8000-000000000101', 290, 'CORRECTIVE', 'Replaced the spindle belt after it slipped under heavy cuts', 'tech1'),
    ('00000000-0000-4000-8000-000000000101', 245, 'PREVENTIVE', 'Quarterly service: way lube and coolant changed', 'tech1'),
    ('00000000-0000-4000-8000-000000000101', 155, 'PREVENTIVE', 'Quarterly service; spindle runout 0.004 mm, within tolerance', 'tech1'),
    ('00000000-0000-4000-8000-000000000101',  65, 'PREVENTIVE', 'Quarterly service: way lube and coolant changed, chuck jaws greased', 'tech1'),
    -- Hydraulic Press 02, every 60 days
    ('00000000-0000-4000-8000-000000000102', 310, 'PREVENTIVE', 'Hydraulic oil and return filter changed', 'tech1'),
    ('00000000-0000-4000-8000-000000000102', 250, 'PREVENTIVE', 'Accumulator pre-charge checked, oil topped up', 'tech1'),
    ('00000000-0000-4000-8000-000000000102', 195, 'CORRECTIVE', 'Replaced the main cylinder seal after an oil leak', 'HydroServ Ltd'),
    ('00000000-0000-4000-8000-000000000102', 130, 'PREVENTIVE', 'Hydraulic oil and return filter changed', 'tech1'),
    ('00000000-0000-4000-8000-000000000102',  40, 'INSPECTION', 'Slight oil seepage at the main cylinder seal again; keep an eye on it', 'tech1'),
    -- Conveyor Belt 03, every 30 days
    ('00000000-0000-4000-8000-000000000103', 118, 'PREVENTIVE', 'Belt tension and tracking adjusted, rollers cleaned', 'tech1'),
    ('00000000-0000-4000-8000-000000000103',  88, 'PREVENTIVE', 'Belt tension and tracking adjusted', 'tech1'),
    ('00000000-0000-4000-8000-000000000103',  74, 'CORRECTIVE', 'Replaced a worn drive roller bearing that was making noise', 'tech1'),
    ('00000000-0000-4000-8000-000000000103',  58, 'PREVENTIVE', 'Belt tension and tracking adjusted', 'tech1'),
    ('00000000-0000-4000-8000-000000000103',  27, 'PREVENTIVE', 'Belt tension adjusted; slight wear on the belt edge', 'tech1'),
    -- Air Compressor 04, every 180 days
    ('00000000-0000-4000-8000-000000000104', 540, 'PREVENTIVE', 'Air and oil filters replaced, oil changed', 'Atlas Copco service'),
    ('00000000-0000-4000-8000-000000000104', 360, 'PREVENTIVE', 'Air and oil filters replaced, oil changed', 'Atlas Copco service'),
    ('00000000-0000-4000-8000-000000000104', 230, 'INSPECTION', 'Condensate drains and safety valve checked, no leaks', 'tech1'),
    ('00000000-0000-4000-8000-000000000104', 172, 'PREVENTIVE', 'Oil separator replaced, air and oil filters replaced, oil changed', 'Atlas Copco service'),
    -- Welding Robot 05, every 365 days
    ('00000000-0000-4000-8000-000000000105', 330, 'PREVENTIVE', 'Annual service: gearbox oil changed, cable harness checked', 'KUKA service'),
    ('00000000-0000-4000-8000-000000000105', 140, 'CORRECTIVE', 'Recalibrated axis 4 after a collision with a fixture', 'tech1'),
    ('00000000-0000-4000-8000-000000000105',  30, 'INSPECTION', 'Monthly check of the torch, cables and cell guards', 'tech1')
) AS e (machine_id, days_ago, type, description, performed_by);
