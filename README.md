# BugKill AI

BugKill AI lets you connect a GitHub repository, ask questions about its code, and get answers grounded in the files from that repository.

The project has three separate applications: a Next.js frontend, an Express backend, and a FastAPI AI service. PostgreSQL with pgvector stores users, repository sessions, chat history, and indexed code chunks. Docker Compose starts the database only; the three applications run separately.

## How it works

1. Sign in and submit a GitHub repository URL from the chat page.
2. The Express backend creates a repository session and asks the AI service to index it.
3. The AI service clones the repository, records the commit SHA, parses supported source files with Tree-sitter, and splits large files into chunks.
4. Gemini creates an embedding for each chunk. The AI service saves the source, metadata, and embedding in PostgreSQL.
5. When you ask a question, the backend checks that the session belongs to you and that indexing finished, then sends the question and commit SHA to the AI service.
6. The AI service searches that repository and commit using vector search and BM25, combines the rankings, and asks Gemini to answer using the retrieved code.
7. The backend saves the question and answer. The frontend displays them and lets you return to, rename, or delete chat sessions.

The frontend talks to the Express backend. The backend handles accounts, repository sessions, and chat history, and passes indexing and chat requests to the AI service. The AI service does not replace the backend's user or chat APIs.

## Project layout

| Folder | What it contains |
| --- | --- |
| `frontend/` | Next.js app: landing page, account screens, and repository chat workspace. |
| `backend/` | Express API: account and email verification, repository sessions, chat history, and calls to the AI service. |
| `ai-service/` | FastAPI app: repository ingestion, code parsing, embeddings, retrieval, and generated answers. |
| `backend/migrations/` | PostgreSQL migrations for application data such as users, repositories, and messages. |
| `ai-service/migrations/` | PostgreSQL migration for code chunks and the pgvector extension. |
| `test-repo/` | Supporting sample and agent code; it is not needed to run the three main applications. |

## What you need

- Node.js and npm
- Python and [uv](https://docs.astral.sh/uv/)
- Git
- Docker Desktop (or Docker Engine with Compose)
- A Gemini API key
- Gmail OAuth credentials for the backend email service (it currently checks for these when it starts)

## Configure the environment

There are separate environment files because each application loads its own settings. Create them locally and do not commit real credentials.

### Repository root: `.env`

Docker Compose reads these values when it starts PostgreSQL:

```env
POSTGRES_USER=bugdady
POSTGRES_PASSWORD=choose-a-local-password
POSTGRES_DB=bugdady
```

### `backend/.env`

The backend and migration CLI need database settings. Keep the `DATABASE_URL` values consistent with the `DB_*` values.

```env
PORT=5000
FRONTEND_URL=http://localhost:3000
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_TIMEOUT_MS=300000

DB_HOST=localhost
DB_PORT=5433
DB_USER=bugdady
DB_PASSWORD=choose-a-local-password
DB_NAME=bugdady
DATABASE_URL=postgres://bugdady:choose-a-local-password@localhost:5433/bugdady

JWT_ACCESS_SECRET=use-a-long-random-secret
JWT_REFRESH_SECRET=use-a-different-long-random-secret
JWT_RESET_SECRET=use-another-long-random-secret

MAIL_USER=your-gmail-address
CLIENT_ID=your-gmail-oauth-client-id
CLIENT_SECRET=your-gmail-oauth-client-secret
REFRESH_TOKEN=your-gmail-oauth-refresh-token
```

The backend accepts `EMAIL_USER` as an alternative to `MAIL_USER`. Cookie settings such as `COOKIE_SAME_SITE` and `COOKIE_DOMAIN` are optional; the default same-site setting is `lax`.

### `ai-service/.env`

```env
GEMINI_API_KEY=your-gemini-api-key
DATABASE_URL=postgres://bugdady:choose-a-local-password@localhost:5433/bugdady

DB_HOST=localhost
DB_PORT=5433
DB_USER=bugdady
DB_PASSWORD=choose-a-local-password
DB_NAME=bugdady

# Optional; the service has a default chat model.
GEMINI_CHAT_MODEL=your-supported-gemini-chat-model
```

### `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

The frontend defaults to `http://localhost:5000` if this value is omitted. Browser API calls go through the frontend's same-origin `/api` proxy so authentication cookies work when the frontend and backend are hosted on different domains. Set this variable to the backend origin in production. Leave the backend's optional `COOKIE_DOMAIN` unset so its cookies are scoped to the frontend host through the proxy.

## Run locally

Start each application in its own terminal. The commands below are for PowerShell, run from the repository root unless a step says otherwise.

### 1. Start PostgreSQL

Make sure the root `.env` is configured, then run:

```powershell
docker compose up -d pgvector
```

PostgreSQL is available on port `5433` on your machine.

### 2. Install backend dependencies and run database migrations

```powershell
cd backend
npm install
```

With `backend/.env` configured, run the two migration sets. They use separate migration-history tables because they live in different folders and have independent version histories. The FastAPI service uses the same SQL migration through this CLI; it does not run schema migrations at startup.

```powershell
npm run migrate -- up --envPath .env --migrations-table backend_migrations
npm run migrate -- up --envPath .env --migrations-dir ../ai-service/migrations --migrations-table ai_service_migrations
```

For production, configure `DATABASE_URL` separately for each Render service: Express must use Supabase PostgreSQL, and FastAPI must use its separate Render PostgreSQL database with pgvector. Do not share either connection string between the services. The migration commands above are for local development only. If production migrations are needed, target backend migrations to Supabase and AI-service migrations to Render PostgreSQL separately, after verifying each destination and reviewing the pending SQL. Preserve each database's existing migration-history table name; never use `--fake` to bypass a schema migration. This chat communication fix does not require a database migration.

Start the Express API:

```powershell
npm run dev
```

It listens on `http://localhost:5000` by default.

### 3. Install and start the AI service

From the repository root, create a Python environment if you do not already have one, then install the AI service requirements:

```powershell
uv venv .venv
uv pip install --python .\.venv\Scripts\python.exe -r .\ai-service\requirements.txt
```

Start the service:

```powershell
cd ai-service
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

The AI service has a health endpoint at `http://localhost:8000/health`.

### 4. Install and start the frontend

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Tests and checks

Run these from the folder for the application you are checking:

```powershell
# backend
cd backend
npm test

# frontend
cd frontend
npm run lint
npm run build

# AI service (from ai-service, using the root .venv)
cd ai-service
..\.venv\Scripts\python.exe -m unittest discover -s tests
```

## A few notes

- The backend only accepts HTTPS GitHub repository URLs for ingestion. The AI service clones the repository's current commit and keeps its SHA with the indexed chunks.
- Vector search and BM25 are both scoped to the repository and commit selected for the chat. Gemini handles embeddings and answer generation.
- Chat retrieval combines vector search and BM25 rankings without loading a separate machine-learning reranker.
- BM25 currently reads the selected repository and commit's chunks to build its search corpus for a query. This keeps the database schema simple, but may need a persisted lexical index if repositories become large.
- The Express API exposes the application routes under `/api`; the AI service exposes its chat and ingestion routes under `/api/chat/` and `/api/ingest/`.
