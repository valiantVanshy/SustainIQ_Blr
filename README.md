# SustainIQ Bengaluru

**Project By:** Vanshika Sharma

SustainIQ Bengaluru is a sustainability dashboard for exploring ward scores, comparing neighbourhoods, and managing citizen reports.

Ward scores are illustrative, not official city measurements. Citizen reports are stored persistently in SQLite.

## Features

- Dashboard with ward sustainability scores and citizen report counts.
- Ward search, zone filtering, and comparison of up to three wards.
- Citizen report submission, status tracking, and status history.
- Report deletion with confirmation.

## Technology

React and Vite for the frontend, Node.js 24's built-in HTTP server for the backend, and `node:sqlite` for storage.

## Setup

Install **Node.js 24.x** with npm. Run the following commands from the project folder. Copy `.env.example` only during first-time setup; keep your existing `.env` on subsequent runs.

### Windows (PowerShell)

```powershell
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run build
npm.cmd start
```

### macOS (Terminal)

```sh
cp .env.example .env
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:3001**. Stop the server with **Ctrl+C**.

### Development

Run these commands in separate terminals:

```sh
npm run server
```

```sh
npm run dev
```

Open the Vite URL shown in the terminal, normally **http://127.0.0.1:5173**. Vite proxies `/api` requests to the backend on port 3001. Restart the backend after changing server code. On Windows, use `npm.cmd` in place of `npm`.

## Configuration

Set environment variables in `.env`, which is excluded from Git.

| Variable      | Default                 | Purpose                                                 |
| ------------- | ----------------------- | ------------------------------------------------------- |
| `PORT`        | `3001`                  | Backend port                                            |
| `HOST`        | `127.0.0.1`             | Server bind address                                     |
| `DB_PATH`     | `./data/reports.sqlite` | SQLite database file                                    |
| `ADMIN_TOKEN` | Unset                   | Secret for administrator status updates through the API |

Replace the placeholder `ADMIN_TOKEN` in `.env` with a long random secret before using administrator status updates. If it is unset, those updates are disabled. Report submission, tracking, and deletion do not require a token. Anyone with access to the app can delete a report after confirming in the interface.

## Project structure

```text
src/                  React screens, API helper, and styles
shared/               Ward profiles, index calculation, and constants
server/index.js       HTTP routes, validation, authorization, and static files
server/database.js    SQLite connection and schema
tests/api.test.js     API and persistence tests
```

The frontend sends report requests to `/api`. The server validates input and uses parameterized SQL to store reports and status history. Production builds are served from `dist/` by the same Node server.

## Sustainability index

```text
Index = 0.30 * AQ + 0.25 * WQ + 0.25 * TE + 0.20 * WM
        - 0.20 * standard deviation(AQ, WQ, TE, WM)
```

AQ represents air quality, WQ water quality, TE transport and ecology, and WM waste management. The result is clamped to 0-100 and rounded to one decimal. Citizen reports do not change ward scores.

## API

| Method | Endpoint                  | Purpose                                                   |
| ------ | ------------------------- | --------------------------------------------------------- |
| GET    | `/api/health`             | Check server and database availability                    |
| GET    | `/api/wards`              | Retrieve ward profiles                                    |
| GET    | `/api/reports`            | List reports with filters and pagination                  |
| POST   | `/api/reports`            | Submit a report                                           |
| GET    | `/api/reports/:id`        | Retrieve a report and status history                      |
| DELETE | `/api/reports/:id`        | Delete a report and its history                           |
| PATCH  | `/api/reports/:id/status` | Update status using `Authorization: Bearer <ADMIN_TOKEN>` |

Report submissions accept `wardId`, `category`, `location` (3-120 characters), and `description` (10-2,000 characters) as JSON. Categories are Waste, Water, Air, Green spaces, and Roads. Statuses are Submitted, In review, In progress, and Resolved.

The report list accepts `wardId`, `status`, `limit` (1-100), and `offset` query parameters.

## Tests

Build the frontend before running the tests:

```sh
npm run build
npm test
```

Tests use a temporary database and check validation, protected status updates, deletion, and persistence after server restarts. On Windows, use `npm.cmd`.

## Deployment

Use a server with Node.js 24 and persistent storage. Run `npm ci` and `npm run build`, configure the environment variables, and start with `npm start`. Set `HOST=0.0.0.0` for remote access and `DB_PATH` to a file on persistent storage. Use HTTPS for remote access and run one application instance per database.

### Docker

With Docker running and `.env` configured:

```sh
docker build -t sustainiq .
docker volume create sustainiq-data
docker run -d --name sustainiq -p 3001:3001 --env-file .env -e HOST=0.0.0.0 -e DB_PATH=/app/data/reports.sqlite --mount source=sustainiq-data,target=/app/data sustainiq
```

Reuse the `sustainiq-data` volume when replacing the container to retain reports. To back up the database, stop the app and copy the data directory, including any WAL files.
