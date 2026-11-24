# FixFlow

Project 2 for CEBP: a distributed industrial maintenance system. A technician uploads a photo of a faulty machine, an AI agent analyzes it against the machine's history, and the team follows the resulting maintenance report in a web UI.

## Repository layout

| Path | What it is | Port |
| --- | --- | --- |
| `contracts/` | Shared DTOs, the `report.created` event, `AiReportService` and its mock, the Flyway migrations (plain jar) | – |
| `s1-write/` | S1 write server: auth, report upload, machines; publishes to Kafka (Spring Boot) | 8081 |
| `s2-read/` | S2 read server: Kafka consumer, AI pipeline, every `GET` endpoint (Spring Boot) | 8082 |
| `ai-agent/` | Gemini-backed `AiReportService`, a library loaded by S2 (plain jar) | – |
| `mcp-server/` | Spring AI MCP server with read-only machine tools (Spring Boot) | 8090 |
| `client/` | React + TypeScript + Vite web app, and its Nginx image | 3000 |
| `docker/` | Files Docker Compose mounts: the Postgres init script | – |

The root `pom.xml` is the Maven parent: it pins Spring Boot 3.5 and Java 21, and manages the versions of the internal modules and the Spring AI BOM. Add dependencies in a module's own `pom.xml` without a `<version>`.

## Contracts

- [`contracts/openapi.yaml`](contracts/openapi.yaml) describes every S1 and S2 endpoint. The client's API types are generated from it (`npm run gen:api` in `client/`, checked in CI), and its MSW mocks are typed with them.
- What the client expects from S1 and S2 beyond the schemas:
  - The JWT's `sub` claim is the username and `exp` is its expiry. The client shows the username and drops an expired token on load.
  - The browser calls both servers directly from `http://localhost:3000`, so both answer CORS preflights for that origin, allowing `GET`, `POST`, `PUT` and `DELETE` and the `Authorization` and `Content-Type` headers.
  - A `401` on any call signs the user out and sends them to the login page, so only answer `401` for a missing, invalid or expired token. A logged-in user without the right role gets `403`.
- The Java side lives in `com.fixflow.contracts`:
  - `api`: request and response records
  - `event`: the `report.created` event and Kafka topic names
  - `webhook`: the `POST /internal/report-ready` payload
  - `ai`: `AiReportService`, `AiReportResult` and `AiReportException`
  - `model`: the shared enums
- Run S2 with `--spring.profiles.active=mock` to use `MockAiReportService` instead of Gemini. The description decides the severity:
  - fire, smoke, spark or burn → `CRITICAL`
  - leak, overheat, crack or broken → `HIGH`
  - noise, vibration, wear or loose → `MEDIUM`
  - anything else → `LOW`
  - `#fail` anywhere in the description makes the mock throw `AiReportException`, to test the `FAILED` path.
- `OpenApiContractTest` fails the build if the spec and the Java records drift apart. Change a contract only with agreement from both sides, and update both files in the same PR.

## Database

One shared PostgreSQL 16 database. The Flyway migrations live in [`contracts/src/main/resources/db/migration`](contracts/src/main/resources/db/migration), so every module has them on its classpath, but only S1 runs them, on startup.

| Table | Written by | Holds |
| --- | --- | --- |
| `users` | S1 | Logins: username, BCrypt hash, role |
| `machines` | S1 | Name, model, location, install date, days between preventive services |
| `images` | S1 | Where S1 saved each upload, its content type and size |
| `reports` | S1 | One row per upload: machine, user, image, description, status, `completed_at`, `error` |
| `ai_reports` | S2 | The AI result for a report; `report_id` is unique, so a redelivered event can't add a second one |
| `maintenance_events` | seed only | Past maintenance per machine, for `GET /machines/{id}/history` and the MCP tools |

- Columns that hold an enum are `VARCHAR` with a `CHECK` listing the Java enum's names, so `@Enumerated(EnumType.STRING)` maps them. `recommendations` is a `text[]`, which Hibernate maps to a `List<String>` and JDBC to a `String[]`.
- `V2__seed.sql` adds the demo data:
  - Logins `tech1` (TECHNICIAN) and `manager1` (MANAGER), both with the password `fixflow`.
  - 5 machines with fixed IDs, `00000000-0000-4000-8000-000000000101` to `…105`, and 3 to 6 history entries each.
  - The history is dated relative to the day the migration runs. Counting from the last preventive service, Hydraulic Press 02 is overdue, Conveyor Belt 03 and Air Compressor 04 are due within 10 days, and the other two are fine.
- Connection settings come from `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD`. They default to `localhost`, `5432`, `fixflow`, `fixflow` and `fixflow`.
- mcp-server connects as `DB_READONLY_USER`, a login that can only `SELECT`. The Compose database creates it on its first start (`docker/postgres/init`).
- Never edit a migration that is already on `main`. Add a new `V3__….sql` instead.
- `DatabaseMigrationsTest` runs the migrations against a real Postgres (Testcontainers). It checks the six tables, that each `CHECK` matches its Java enum, the seed data, and the constraints the services rely on.
- In S2 or mcp-server tests, add `flyway-core` and `flyway-database-postgresql` with `<scope>test</scope>`. A `@SpringBootTest` then builds the same schema in its Testcontainers database. Keep Flyway out of their runtime dependencies so only S1 migrates.

## Prerequisites

- JDK 21 or newer (the build targets Java 21)
- Node.js 22.22.2+ or 24.15+ (CI and the client image use 24)
- Docker, running: the backend tests start PostgreSQL with Testcontainers, and S1 needs a database to start
- No Maven install needed: use the wrapper (`./mvnw`, or `mvnw.cmd` on Windows)

## Build and run

Backend, from the repo root:

```bash
./mvnw verify                          # build every module and run the tests
./mvnw install -DskipTests             # once, and again after changing contracts/ or ai-agent/
./mvnw -pl s1-write spring-boot:run    # run one service (s1-write, s2-read or mcp-server)
```

S1 needs PostgreSQL to start: run `docker compose up -d postgres` first (see below).

In IntelliJ, open the root `pom.xml` as a project and run the `*Application` class of a service.

Client:

```bash
cd client
npm install
npm run dev        # http://localhost:3000, against S1 and S2
npm run dev:mock   # the same, with a mock API in the browser: no backend needed
npm test           # Vitest
```

See [`client/README.md`](client/README.md) for how the client is organized.

## Docker Compose

`docker-compose.yml` starts the shared infrastructure and the client. Each backend package adds its own service to it.

```bash
cp .env.example .env                      # then fill in JWT_SECRET and WEBHOOK_SECRET
docker compose up -d                      # everything below
docker compose up -d postgres kafka-init  # only the database and Kafka, to run the services from the IDE
docker compose down                       # stop; the data stays in the volumes
docker compose down -v                    # stop and delete the database, Kafka data and uploaded images
```

| Service | Address | What it is |
| --- | --- | --- |
| `postgres` | `localhost:5432` | PostgreSQL 16; creates the read-only login on its first start |
| `kafka` | `localhost:9092` from the host, `kafka:29092` from containers | Kafka in KRaft mode, one node |
| `kafka-init` | – | Creates `report.created` and `report.created.DLT` (3 partitions each), then exits |
| `kafka-ui` | http://localhost:8080 | Topics, messages and consumer groups |
| `client` | http://localhost:3000 | The React app served by Nginx (`client/Dockerfile`) |

- Kafka's auto-create is off, so the only topics are the ones `kafka-init` makes.
- The `images-data` volume holds the uploaded photos. S1 and S2 both mount it at `/data/images`, so run both containers as the same user (UID) to let S2 read what S1 writes.
- The client calls S1 and S2 directly from the browser. Their URLs are baked in when the image is built, from the `VITE_S1_URL` and `VITE_S2_URL` build args.
- The database init script only runs when the `postgres-data` volume is new. After changing it, run `docker compose down -v`.

To add your service, build from the repo root (the Maven build needs the parent `pom.xml` and `contracts/`) and wait for the infrastructure. For example:

```yaml
  s2-read:
    build:
      context: .
      dockerfile: s2-read/Dockerfile
    ports:
      - "8082:8082"
    environment:
      DB_HOST: postgres
      DB_NAME: ${DB_NAME}
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      SPRING_KAFKA_BOOTSTRAP_SERVERS: kafka:29092
      JWT_SECRET: ${JWT_SECRET}
      WEBHOOK_SECRET: ${WEBHOOK_SECRET}
    volumes:
      - images-data:/data/images
    depends_on:
      postgres:
        condition: service_healthy
      kafka-init:
        condition: service_completed_successfully
```

mcp-server uses `DB_USER: ${DB_READONLY_USER}` and `DB_PASSWORD: ${DB_READONLY_PASSWORD}` instead.

## Workflow

- One branch per task, opened as a PR against `main` with 1 reviewer.
- CI (`.github/workflows/ci.yml`) builds and tests the backend; lints, tests and builds the client and checks its API types match `openapi.yaml`; and checks the Compose file and the client image on every PR. Keep it green before merging.
