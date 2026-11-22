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
| `client/` | React + TypeScript + Vite web app | 3000 |

The root `pom.xml` is the Maven parent: it pins Spring Boot 3.5 and Java 21, and manages the versions of the internal modules and the Spring AI BOM. Add dependencies in a module's own `pom.xml` without a `<version>`.

## Contracts

- [`contracts/openapi.yaml`](contracts/openapi.yaml) describes every S1 and S2 endpoint. The client's MSW mocks and API types are built from it.
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
- Never edit a migration that is already on `main`. Add a new `V3__….sql` instead.
- `DatabaseMigrationsTest` runs the migrations against a real Postgres (Testcontainers). It checks the six tables, that each `CHECK` matches its Java enum, the seed data, and the constraints the services rely on.
- In S2 or mcp-server tests, add `flyway-core` and `flyway-database-postgresql` with `<scope>test</scope>`. A `@SpringBootTest` then builds the same schema in its Testcontainers database. Keep Flyway out of their runtime dependencies so only S1 migrates.

## Prerequisites

- JDK 21 or newer (the build targets Java 21)
- Node.js 20.19+ or 22.12+ (CI uses 24)
- Docker, running: the backend tests start PostgreSQL with Testcontainers, and S1 needs a database to start
- No Maven install needed: use the wrapper (`./mvnw`, or `mvnw.cmd` on Windows)

## Build and run

Backend, from the repo root:

```bash
./mvnw verify                          # build every module and run the tests
./mvnw install -DskipTests             # once, and again after changing contracts/ or ai-agent/
./mvnw -pl s1-write spring-boot:run    # run one service (s1-write, s2-read or mcp-server)
```

S1 needs PostgreSQL to start. Until the Compose file is in, start one with:

```bash
docker run -d --name fixflow-db -p 5432:5432 \
  -e POSTGRES_DB=fixflow -e POSTGRES_USER=fixflow -e POSTGRES_PASSWORD=fixflow postgres:16-alpine
```

In IntelliJ, open the root `pom.xml` as a project and run the `*Application` class of a service.

Client:

```bash
cd client
npm install
npm run dev      # http://localhost:3000
```

## Workflow

- One branch per task, opened as a PR against `main` with 1 reviewer.
- CI (`.github/workflows/ci.yml`) builds and tests the backend and lints and builds the client on every PR; keep it green before merging.
