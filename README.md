# HIPAA / PII Compliance Sandbox

A local TypeScript Node.js microservices sandbox for testing a **HIPAA (PHI) and PII compliance check agent**.

The services are cleanly structured, but each one contains a **deliberate compliance violation** that a compliance agent should be able to detect, explain, and fix.

> **Warning:** This project is intentionally insecure. Do not deploy it, and only use fake data.

## Services

| Service | Port | Focus | Database | Endpoints |
|---|---|---|---|---|
| `patient-service` | 3001 | HIPAA / PHI | `patients.db` | `GET /health`, `POST /api/patients` |
| `notification-service` | 3002 | PII | `notifications.db` | `GET /health`, `POST /api/notify` |

## Tech Stack

- Node.js 22+ with TypeScript (strict mode, ES modules)
- Express 5
- SQLite via `better-sqlite3`
- Zod for request and environment validation
- npm workspaces + `concurrently`
- `tsx` for development, `tsc` for builds

## Project Structure

```
.
├── package.json              # npm workspaces + root scripts
├── tsconfig.base.json        # shared strict TypeScript config
├── patient-service/
│   └── src/
│       ├── index.ts          # entry point, graceful shutdown
│       ├── app.ts            # Express app factory
│       ├── config/           # environment config (Zod)
│       ├── controllers/
│       ├── db/               # connection + schema
│       ├── errors/           # AppError classes
│       ├── middleware/       # centralized error handler
│       ├── models/           # TypeScript types
│       ├── repositories/     # data access
│       ├── routes/
│       ├── scripts/          # database init script
│       └── validation/       # Zod schemas
└── notification-service/
    └── src/                  # same layout, plus services/mockSmsGateway.ts
```

## Getting Started

```sh
npm install
npm run dev
```

Both services start together. To check that they are running, open:

- http://localhost:3001/health
- http://localhost:3002/health

> Opening `http://localhost:3001/` returns a `404 NOT_FOUND` JSON response. This is expected because there is no root route.

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start both services in watch mode |
| `npm run build` | Compile both services to `dist/` |
| `npm start` | Run the compiled services |
| `npm run typecheck` | Type-check both services |
| `npm run db:init` | Create the SQLite databases and tables |

### Configuration

Each service reads environment variables, or a `.env` file in its own folder. See `.env.example` in each service.

| Variable | patient-service | notification-service |
|---|---|---|
| `NODE_ENV` | `development` | `development` |
| `PORT` | `3001` | `3002` |
| `DB_PATH` | `patients.db` | `notifications.db` |
| `MOCK_FAILURE_RATE` | n/a | `0.3` (0–1 chance that a mock SMS fails) |

## API Usage

### Register a patient

```sh
curl -X POST http://localhost:3001/api/patients \
  -H 'Content-Type: application/json' \
  -d '{
    "full_name": "Jane Test",
    "ssn": "000-12-3456",
    "dob": "1980-01-01",
    "diagnosis": "Hypertension",
    "medical_notes": "Fake test record"
  }'
```

Response `201 Created`:

```json
{ "id": "68df3cca-91fa-40d3-a7e4-46550cb3a177" }
```

### Send an appointment reminder

```sh
curl -X POST http://localhost:3002/api/notify \
  -H 'Content-Type: application/json' \
  -d '{
    "full_name": "Jane Test",
    "email": "jane@example.com",
    "phone_number": "+15550100",
    "home_address": "1 Fake St",
    "appointment_at": "2026-11-01T10:00:00Z",
    "simulate_failure": true
  }'
```

- `202 Accepted`: the mock SMS was sent.
- `502 Bad Gateway`: the mock SMS failed. Set `"simulate_failure": true` to force this.

### Error format

All errors use the same shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed", "details": [] } }
```

## Intentional Compliance Violations

These are the issues a compliance agent should find.

| # | Location | Type | Issue |
|---|---|---|---|
| 1 | [patient-service/src/controllers/patientController.ts](patient-service/src/controllers/patientController.ts) | HIPAA / PHI | A debug log prints the raw request body, exposing SSN, date of birth, diagnosis, and medical notes in plain-text logs. The body is logged even when it fails validation. |
| 2 | [notification-service/src/controllers/notificationController.ts](notification-service/src/controllers/notificationController.ts) | PII | When a mock delivery fails, the error log prints the phone number, full name, and home address without masking. |
| 3 | `patients.db` / `notifications.db` | PHI / PII at rest | Sensitive fields are stored unencrypted in SQLite. |

### Suggested test workflow

1. **Static scan:** run the agent against the source code and check that it flags the issues above.
2. **Runtime scan:** run `npm run dev`, send the requests above, and have the agent review the console output for leaked PHI/PII.
3. **Fix and verify:** apply the agent's fixes on a separate branch, rerun the requests, and confirm that no sensitive data is logged and the endpoints still work.

Keep `main` as the unfixed baseline so the test can be repeated.

## License

For testing and educational use only.
