-- FixFlow schema: one shared PostgreSQL 16 database.
-- Flyway runs these migrations from S1 only. S2 and mcp-server only read the tables they don't own.
--
-- Columns that hold a Java enum are VARCHAR with a CHECK constraint listing the enum's names
-- (com.fixflow.contracts.model), so JPA's @Enumerated(EnumType.STRING) maps them directly.
-- Timestamps are TIMESTAMPTZ (Instant in Java); plain dates are DATE (LocalDate).
-- IDs are UUIDs; the services generate them, and the defaults cover hand-written inserts.

-- Logins. Written by S1 (POST /auth/users).
CREATE TABLE users (
    id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    username      VARCHAR(50)  NOT NULL,
    password_hash VARCHAR(100) NOT NULL, -- BCrypt
    role          VARCHAR(20)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT ck_users_role CHECK (role IN ('TECHNICIAN', 'MANAGER'))
);

-- Written by S1 (POST/PUT/DELETE /machines).
CREATE TABLE machines (
    id                    UUID         NOT NULL DEFAULT gen_random_uuid(),
    name                  VARCHAR(100) NOT NULL,
    model                 VARCHAR(100) NOT NULL,
    location              VARCHAR(100) NOT NULL,
    installed_at          DATE         NOT NULL,
    service_interval_days INTEGER      NOT NULL, -- days between preventive services
    CONSTRAINT pk_machines PRIMARY KEY (id),
    CONSTRAINT ck_machines_service_interval CHECK (service_interval_days >= 1)
);

-- Uploaded photos. Written by S1, which saves the file to the shared volume first.
-- S2 streams the file back from `path` for GET /images/{id}.
CREATE TABLE images (
    id           UUID         NOT NULL DEFAULT gen_random_uuid(),
    path         VARCHAR(255) NOT NULL, -- where S1 saved the file, e.g. /data/images/<id>.jpg
    content_type VARCHAR(20)  NOT NULL,
    size_bytes   BIGINT       NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_images PRIMARY KEY (id),
    CONSTRAINT uq_images_path UNIQUE (path),
    CONSTRAINT ck_images_content_type CHECK (content_type IN ('image/jpeg', 'image/png')),
    CONSTRAINT ck_images_size CHECK (size_bytes BETWEEN 1 AND 10485760) -- 10 MB
);

-- One row per upload. S1 inserts it as PENDING in the same transaction as its image,
-- then sets status, completed_at and error when S2 calls POST /internal/report-ready.
CREATE TABLE reports (
    id           UUID        NOT NULL DEFAULT gen_random_uuid(),
    machine_id   UUID        NOT NULL,
    user_id      UUID        NOT NULL,
    image_id     UUID        NOT NULL,
    description  TEXT        NOT NULL,
    status       VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    error        TEXT,                  -- why the AI failed, from the webhook
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,           -- set together with DONE or FAILED
    CONSTRAINT pk_reports PRIMARY KEY (id),
    -- No cascade: deleting a machine that still has reports fails, and S1 answers 409.
    CONSTRAINT fk_reports_machine FOREIGN KEY (machine_id) REFERENCES machines (id),
    CONSTRAINT fk_reports_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_reports_image FOREIGN KEY (image_id) REFERENCES images (id),
    CONSTRAINT uq_reports_image UNIQUE (image_id),
    CONSTRAINT ck_reports_status CHECK (status IN ('PENDING', 'DONE', 'FAILED')),
    CONSTRAINT ck_reports_completed_at CHECK ((status = 'PENDING') = (completed_at IS NULL)),
    CONSTRAINT ck_reports_error CHECK (error IS NULL OR status = 'FAILED')
);

-- GET /reports: a technician's own reports, a machine's reports, and everything newest first.
CREATE INDEX ix_reports_user_created ON reports (user_id, created_at DESC);
CREATE INDEX ix_reports_machine_created ON reports (machine_id, created_at DESC);
CREATE INDEX ix_reports_created ON reports (created_at DESC);

-- The AI's result for a report. Written by S2 before it calls the webhook.
-- The contract's id_image is not stored: it is the image_id of the report.
CREATE TABLE ai_reports (
    id                UUID        NOT NULL DEFAULT gen_random_uuid(),
    report_id         UUID        NOT NULL,
    report            TEXT        NOT NULL,
    severity          VARCHAR(10) NOT NULL,
    recommendations   TEXT[]      NOT NULL DEFAULT '{}',
    next_service_date DATE        NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_ai_reports PRIMARY KEY (id),
    CONSTRAINT fk_ai_reports_report FOREIGN KEY (report_id) REFERENCES reports (id) ON DELETE CASCADE,
    -- Idempotency: a redelivered report.created event cannot create a second AI report.
    CONSTRAINT uq_ai_reports_report UNIQUE (report_id),
    CONSTRAINT ck_ai_reports_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

-- Past maintenance per machine, for GET /machines/{id}/history and the MCP tools
-- get_machine_history and get_maintenance_schedule. Filled by the seed; no endpoint writes it yet.
CREATE TABLE maintenance_events (
    id           UUID         NOT NULL DEFAULT gen_random_uuid(),
    machine_id   UUID         NOT NULL,
    performed_at TIMESTAMPTZ  NOT NULL,
    type         VARCHAR(20)  NOT NULL,
    description  TEXT         NOT NULL,
    performed_by VARCHAR(100) NOT NULL, -- a username or an outside service company
    CONSTRAINT pk_maintenance_events PRIMARY KEY (id),
    CONSTRAINT fk_maintenance_events_machine FOREIGN KEY (machine_id) REFERENCES machines (id) ON DELETE CASCADE,
    CONSTRAINT ck_maintenance_events_type CHECK (type IN ('PREVENTIVE', 'CORRECTIVE', 'INSPECTION'))
);

CREATE INDEX ix_maintenance_events_machine_performed ON maintenance_events (machine_id, performed_at DESC);
