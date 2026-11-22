#!/bin/sh
# Creates the read-only login that mcp-server uses. The Postgres image runs this once, when the
# postgres-data volume is empty. The tables don't exist yet (S1's Flyway creates them later), so the
# default privileges give this login SELECT on every table the main user creates from now on.
set -eu

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v ON_ERROR_STOP=1 \
     -v owner="$POSTGRES_USER" -v db="$POSTGRES_DB" \
     -v ro_user="$DB_READONLY_USER" -v ro_password="$DB_READONLY_PASSWORD" <<'SQL'
CREATE ROLE :"ro_user" LOGIN PASSWORD :'ro_password';
GRANT CONNECT ON DATABASE :"db" TO :"ro_user";
GRANT USAGE ON SCHEMA public TO :"ro_user";
GRANT SELECT ON ALL TABLES IN SCHEMA public TO :"ro_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public GRANT SELECT ON TABLES TO :"ro_user";
SQL
