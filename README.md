# FixFlow

Project 2 for CEBP: a distributed industrial maintenance system. A technician uploads a photo of a faulty machine, an AI agent analyzes it against the machine's history, and the team follows the resulting maintenance report in a web UI.

## Repository layout

| Path | What it is | Port |
| --- | --- | --- |
| `contracts/` | Shared DTOs, the `report.created` event, `AiReportService` and its mock (plain jar) | – |
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

## Prerequisites

- JDK 21 or newer (the build targets Java 21)
- Node.js 20.19+ or 22.12+ (CI uses 24)
- No Maven install needed: use the wrapper (`./mvnw`, or `mvnw.cmd` on Windows)

## Build and run

Backend, from the repo root:

```bash
./mvnw verify                          # build every module and run the tests
./mvnw install -DskipTests             # once, and again after changing contracts/ or ai-agent/
./mvnw -pl s1-write spring-boot:run    # run one service (s1-write, s2-read or mcp-server)
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
