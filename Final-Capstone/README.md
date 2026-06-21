# Kubernetes Incident Intelligence Engine (Monorepo)

**Production-ready enterprise platform for automated Kubernetes incident detection, analysis, and remediation using AI.**

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React + TS)                     │
│  Dashboard | Incidents | RCA | Dependency Graph | Cluster Health│
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    API Gateway (Auth, RBAC)
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
┌───▼────────┐  ┌──────────▼────────┐  ┌────────▼──────┐
│   REST     │  │  WebSocket (RT)   │  │   Message     │
│   APIs     │  │   Updates         │  │   Queue/Bus   │
└───┬────────┘  └──────────┬────────┘  └────────┬──────┘
    │                      │                      │
    │   ┌──────────────────┼──────────────────┐  │
    │   │                  │                  │  │
    ▼   ▼                  ▼                  ▼  ▼
┌─────────────────────────────────────────────────────────────┐
│                   7 Microservices                           │
├─────────────────────────────────────────────────────────────┤
│ • api-gateway        (Auth, routing, rate-limiting)        │
│ • ingest-service     (Prometheus, Loki, K8s APIs)          │
│ • telemetry-store    (Time-series cache & queries)         │
│ • analysis-service   (LangChain, AI pipelines, RCA)        │
│ • incidents-service  (Incident lifecycle, impact)          │
│ • dependency-service (Service graph, topology)             │
│ • worker-service     (Celery, embeddings, ML tasks)        │
└─────────────────────────────────────────────────────────────┘
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
    ▼                      ▼                      ▼
 PostgreSQL            Redis              Vector DB
 (Relational)          (Cache, Broker)    (Embeddings)
```

## Folder Structure

```
Final-Capstone/
├── services/                          # 7 microservices
│   ├── api-gateway/
│   │   ├── app/main.py               # FastAPI router
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── ingest-service/                # Collects telemetry
│   ├── telemetry-store/               # Query layer
│   ├── analysis-service/              # AI & RCA engine
│   ├── incidents-service/             # Incident management
│   ├── dependency-service/            # Service topology
│   └── worker-service/                # Celery tasks
├── frontend/
│   └── web-app/                       # React + TypeScript + Tailwind
│       ├── src/
│       │   ├── pages/                 # 9 dashboard pages
│       │   ├── components/
│       │   │   ├── layout/            # Sidebar + TopNav
│       │   │   └── shared/            # Cards, Charts, Tables
│       │   ├── hooks/                 # useApi, useWebSocket
│       │   ├── store/                 # Zustand state
│       │   ├── types/                 # TypeScript interfaces
│       │   └── App.tsx                # Routing
│       ├── package.json
│       ├── tailwind.config.js
│       ├── vite.config.ts
│       ├── Dockerfile                 # Multi-stage NGINX
│       └── nginx.conf                 # Reverse proxy config
├── helm/                              # Kubernetes deployment
│   └── charts/ki-engine/
├── deploy/                            # K8s manifests
├── docker-compose.yml                 # Local development
└── README.md                           # This file
```

## Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for frontend dev)
- Python 3.11+ (for backend dev)

### Run Everything with Docker Compose

```bash
docker-compose up --build
```

This starts:
- PostgreSQL (localhost:5432)
- Redis (localhost:6379)
- API Gateway (localhost:8000)
- Frontend (localhost:3000)

### Run Frontend Separately (Dev Mode)

```bash
cd frontend/web-app
npm install
npm run dev
```

Open http://localhost:5173

### Run Backend Services (Dev Mode)

```bash
cd services/api-gateway
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Each service runs on a different port:
- api-gateway: 8000
- ingest-service: 8001
- telemetry-store: 8002
- analysis-service: 8003
- incidents-service: 8004
- dependency-service: 8005
- worker-service: Celery

## Frontend - React Dashboard

**9 Pages with enterprise-grade UI:**

1. **Executive Dashboard** - KPIs, cluster health, incident trends, AI insights
2. **Incident Management** - Search, filter, manage incidents with RBAC
3. **Incident Details** - RCA, timeline, recommended actions, blast radius
4. **AI Analysis Center** - Chat with AI, RCA summaries, log analysis
5. **Cluster Health** - Node/pod/namespace metrics, HPA monitoring
6. **Dependency Graph** - Interactive service topology, blast radius prediction
7. **Deployment Analysis** - Risk assessment, deployment history, rollback tracking
8. **Knowledge Base** - Searchable runbooks, RCA reports, incident summaries
9. **User Management** - RBAC, role-based access control, user provisioning

### Tech Stack
- React 18 + TypeScript
- Tailwind CSS (dark mode)
- React Router 6
- React Query (@tanstack/react-query)
- Zustand (state management)
- Recharts (visualizations)
- WebSocket (real-time updates)

## Backend Microservices (FastAPI)

### 1. API Gateway
- JWT authentication & authorization
- RBAC enforcement
- Rate limiting
- WebSocket proxy for real-time updates
- Request routing to downstream services

### 2. Ingest Service
- Watches Kubernetes Events, Deployments, HPA
- Polls Prometheus for metrics
- Polls Loki for logs
- Normalizes data and emits to message queue
- Webhook endpoints for external sources

### 3. Telemetry Store
- Query adapter for Prometheus (metrics)
- Query adapter for Loki (logs)
- In-memory cache for hot data
- Metadata storage in PostgreSQL

### 4. Analysis Service
- **Log Summarization**: LangChain → summarize thousands of logs
- **Event Correlation**: Match deployments, metrics, crashes, network failures
- **Root Cause Analysis**: Identify probable root cause with confidence
- **Timeline Generation**: Chronological event ordering
- **Dependency Analysis**: Service impact prediction
- **Blast Radius**: Which services affected by which failure
- **AI Recommendations**: Actionable remediation steps

### 5. Incidents Service
- Create, update, close incidents
- Track severity, status, assigned engineer
- Impact assessment
- Audit log for AI-driven actions
- Notification hooks

### 6. Dependency Service
- Build service dependency graph
- Update topology from deployment events
- Compute affected services
- Blast radius analysis

### 7. Worker Service (Celery)
- Background tasks: embedding generation
- Vector DB ingestion (for similarity search)
- ML model training (anomaly detection, risk prediction)
- Scheduled jobs (cleanup, aggregation)

## Database Schema (PostgreSQL)

### Core Tables
```sql
users (id, full_name, email, phone, username, password_hash, profile_picture_url,
       designation, organization_id, role_id, email_verified, created_at)
organizations (id, name, organization_key, industry, created_by, created_at)
workspaces (id, organization_id, name, environment_type, created_at)

roles (id, name, description, created_at)
permissions (id, code, description, created_at)
role_permissions (role_id, permission_id)

clusters (id, workspace_id, name, cloud_provider, region, environment,
          kubernetes_api_url, prometheus_url, grafana_url, loki_url,
          auth_method, status, created_at)

incidents (id, workspace_id, cluster_id, title, description, severity, status, service,
           blast_radius jsonb, ai_confidence float, created_at)
telemetry (id, cluster_id, source_type, source_id, metric_name, metric_value,
           labels jsonb, timestamp)
telemetry_metadata (id, source_type, source_id, timestamp, summary)
events (id, incident_id, source, type, payload jsonb, timestamp)
ai_analyses (id, incident_id, engine, result jsonb, confidence, created_at)

notifications (id, workspace_id, channel, target, severity_filter, enabled, created_at)
audit_logs (id, user_id, organization_id, action, entity_type, entity_id,
            metadata jsonb, created_at)

services (id, name, namespace, owner, status)
dependencies (id, from_service, to_service, type, confidence)

embeddings (id, object_type, object_id, vector, metadata)
```

## API Contracts

### Incidents API
```
POST   /incidents                    # Create
GET    /incidents                    # List (filter, search, paginate)
GET    /incidents/{id}               # Get detail
PATCH  /incidents/{id}               # Update status/severity
GET    /incidents/{id}/timeline      # Ordered events
GET    /incidents/{id}/recommendations # AI suggestions
POST   /incidents/{id}/annotate      # Add human notes
```

### Analysis API
```
POST   /analysis/summarize-logs      # → {summary, highlights}
POST   /analysis/rca                 # → {root_cause, confidence}
POST   /analysis/timeline            # → ordered timeline
GET    /analysis/{incident_id}/recommendations
```

### WebSocket
```
ws://api-gateway/ws/incidents/{id}   # Subscribe to incident updates
ws://api-gateway/ws/cluster/{id}     # Cluster events
ws://api-gateway/ws/alerts           # Alert stream
```

## AI Workflows

### Incident Correlation Pipeline
1. **Ingest**: Collect events (deployment, metrics spike, pod crash)
2. **Normalize**: Convert to common schema
3. **Correlate**: Find related events by time window and service
4. **Aggregate**: Create incident entity
5. **Summarize**: Generate human-readable summary

### RCA Pipeline
1. **Gather Evidence**: Retrieve related logs, metrics, events
2. **Embed**: Convert text to vectors for similarity
3. **Retrieve**: Find similar historical incidents
4. **Generate**: LLM prompts with context → RCA hypothesis
5. **Score**: Assign confidence based on evidence matches
6. **Store**: Save to `ai_analyses` table

### Recommendation Engine
1. **Analyze**: Identify root cause
2. **Template Match**: Find applicable actions from templates
3. **Safety Check**: Verify preconditions (approval gates for critical actions)
4. **Rank**: Prioritize by impact and risk
5. **Explain**: Generate natural language justification

## Deployment

### Docker
Each service has a `Dockerfile` for containerization.

```bash
# Build all images
docker-compose build

# Run with compose
docker-compose up
```

### Kubernetes / Helm
```bash
helm install ki-engine ./helm/charts/ki-engine \
  --namespace kubernetes-incident-intelligence \
  -f values.yaml
```

See `helm/charts/ki-engine/values.yaml` for:
- Replica counts
- Resource limits
- Image registries
- Database credentials
- Vector DB endpoints
- OpenAI API key

### CI/CD (GitHub Actions)
- Lint, test, build Docker images
- Push to registry
- Deploy to staging cluster
- Run smoke tests
- Manual approval → production

## Security & Compliance

- **Auth**: JWT tokens + RBAC at API Gateway
- **Encryption**: TLS for all external communications
- **Audit**: All AI-driven actions logged
- **Data**: PII scrubbing before sending to LLM
- **Rate Limit**: Per user, per service, per model
- **Secrets**: Use Kubernetes Secrets or external secret manager

## Observability

- **Prometheus**: Metrics from all services
- **Grafana**: Dashboards
- **Loki**: Logs aggregation
- **OpenTelemetry**: Distributed tracing
- **Service Mesh**: Istio (optional) for mTLS

## Running Tests

```bash
# Frontend
cd frontend/web-app
npm run lint
npm run type-check

# Backend (per service)
cd services/api-gateway
pytest
```

## Contributing

1. Backend: Add endpoints in `services/{service}/app/api/`
2. Frontend: Add components in `src/components/`, pages in `src/pages/`
3. Types: Update `src/types/index.ts` and service models
4. Styling: Use Tailwind classes, follow dark mode conventions

## Documentation

- [Frontend README](frontend/web-app/README.md)
- [API Design](docs/api-design.md) *(to be created)*
- [Database Schema](docs/schema.md) *(to be created)*
- [Deployment Guide](docs/deployment.md) *(to be created)*

## License

Proprietary - Kubernetes Incident Intelligence Engine

---

**Next Steps:**
1. ✅ Monorepo scaffold with 7 services + frontend
2. ✅ React enterprise dashboard (9 pages)
3. → Database schema & migrations
4. → Full backend service implementations
5. → Kubernetes manifests & Helm chart
6. → CI/CD pipeline
7. → AI pipelines with LangChain

