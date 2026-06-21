# Quick Setup Guide

## Frontend Installation & First Run

```bash
# Navigate to frontend
cd frontend/web-app

# Install dependencies (may take a few minutes)
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local if using custom API URLs (default: http://localhost:8000)

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

## Build for Production

```bash
npm run build
npm run preview
```

## Docker Build

```bash
docker build -t ki-engine-web:latest .
docker run -p 3000:80 ki-engine-web:latest
```

Access at http://localhost:3000

---

## Backend Services Quick Start

### Prerequisites
- Python 3.11+
- Docker (for PostgreSQL, Redis, etc.)

### Start Infrastructure

```bash
docker-compose up -d postgres redis
```

### Run Single Service (api-gateway example)

```bash
cd services/api-gateway

# Create virtual environment
python -m venv .venv

# Activate
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Service health check: http://localhost:8000/health

### Services Port Mapping
- api-gateway: 8000
- ingest-service: 8001
- telemetry-store: 8002
- analysis-service: 8003
- incidents-service: 8004
- dependency-service: 8005
- worker-service: Celery (no HTTP)

---

## Environment Configuration

### Frontend (.env.local)
```
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### Backend (add to each service's .env or docker-compose)
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ki_engine
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=sk-...
VECTOR_DB_URL=http://localhost:19530  # For Milvus or compatible
```

---

## Directory Structure Quick Reference

```
frontend/web-app/
├── src/
│   ├── pages/          # 9 dashboard pages
│   ├── components/     # UI components
│   ├── hooks/          # API & WebSocket
│   ├── store/          # Zustand state
│   ├── types/          # TypeScript types
│   └── App.tsx         # Router
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── Dockerfile          # Production image

services/
├── api-gateway/        # JWT auth, routing
├── ingest-service/     # Telemetry collection
├── telemetry-store/    # Query layer
├── analysis-service/   # AI & RCA
├── incidents-service/  # Incident management
├── dependency-service/ # Service topology
└── worker-service/     # Celery tasks
```

---

## Common Commands

### Frontend
```bash
npm run dev              # Start dev server (http://localhost:5173)
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Linting (if configured)
npm run type-check       # TypeScript check
```

### Backend (Python)
```bash
# From service directory:
uvicorn app.main:app --reload              # Dev server
python -m pytest                           # Run tests
black app                                  # Format code
flake8 app                                 # Lint
```

---

## Troubleshooting

### Frontend npm install fails
```bash
npm cache clean --force
npm install
```

### PostgreSQL connection error
```bash
# Ensure postgres is running:
docker-compose up postgres

# Check connection:
psql postgresql://postgres:postgres@localhost:5432/ki_engine
```

### Port already in use
```bash
# Find process using port 8000:
lsof -i :8000        # macOS/Linux
netstat -ano | grep 8000  # Windows

# Or use different port:
uvicorn app.main:app --port 8001
```

### WebSocket connection fails
Ensure API gateway is running and WebSocket proxy is configured.

---

## Next Steps

1. Start PostgreSQL: `docker-compose up postgres redis`
2. Run frontend: `npm run dev` (from `frontend/web-app/`)
3. Run API gateway: `uvicorn app.main:app --reload` (from `services/api-gateway/`)
4. Open http://localhost:5173

See main README.md for full documentation.
