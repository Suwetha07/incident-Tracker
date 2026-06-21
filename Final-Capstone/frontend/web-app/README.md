Y# Kubernetes Incident Intelligence Engine - Frontend

Modern React + TypeScript + Tailwind CSS dashboard for managing Kubernetes incidents with AI-powered analysis.

## Features

### Pages
- **Dashboard**: Overview of cluster health, KPIs, active alerts, and AI insights
- **Incidents**: Search, filter, and manage production incidents
- **Incident Details**: Root cause analysis, recommended actions, timeline, and blast radius
- **AI Analysis**: Chat with AI assistant about incidents and get RCA summaries
- **Cluster Health**: Node, pod, and namespace resource monitoring
- **Dependency Graph**: Interactive service topology and blast radius analysis
- **Deployment Analysis**: Deployment history, risk assessment, and success rates
- **Knowledge Base**: Searchable runbooks, RCA reports, and incident summaries
- **Users & Roles**: User management and RBAC configuration
- **Notifications**: Real-time alerts and incident updates
- **Settings**: Theme and notification preferences

### Technology Stack
- React 18 + TypeScript
- Tailwind CSS (dark mode)
- React Router 6
- React Query (TanStack Query) for data fetching
- Zustand for state management
- Recharts for visualizations
- WebSocket for real-time updates

## Installation

```bash
cd frontend/web-app
npm install
```

## Configuration

Copy `.env.example` to `.env.local` and update values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

## Development

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## Building

```bash
npm run build
```

Production build output goes to `dist/`.

## Project Structure

```
src/
├── components/
│   ├── layout/
│   │   └── Layout.tsx (Sidebar + TopNav)
│   └── shared/
│       ├── Cards.tsx (KPI, Badge, Status components)
│       └── Charts.tsx (Line, Area, Bar, Pie charts)
├── pages/
│   ├── Dashboard.tsx
│   ├── Incidents.tsx
│   ├── IncidentDetails.tsx
│   ├── AIAnalysis.tsx
│   ├── ClusterHealth.tsx
│   ├── DependencyGraph.tsx
│   ├── DeploymentAnalysis.tsx
│   ├── KnowledgeBase.tsx
│   ├── Users.tsx
│   └── Placeholders.tsx
├── hooks/
│   ├── useApi.ts (React Query hooks)
│   └── useWebSocket.ts (WebSocket hooks)
├── store/
│   └── index.ts (Zustand store)
├── types/
│   └── index.ts (TypeScript interfaces)
├── App.tsx (Router setup)
└── main.tsx (Entry point)
```

## API Integration

The app uses React Query for server state management. Update API endpoints in `src/hooks/useApi.ts`:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
```

All API calls automatically include the JWT token from localStorage.

## WebSocket Integration

Real-time updates via WebSocket:

```typescript
// Subscribe to incident updates
useIncidentUpdates(incidentId, (message) => {
  console.log('Update:', message);
});

// Subscribe to cluster updates
useClusterUpdates(clusterId, (message) => {
  console.log('Cluster event:', message);
});
```

## State Management

Global state via Zustand:

```typescript
import { useDashboardStore } from './store';

const { incidents, setIncidents, isDarkMode, toggleDarkMode } = useDashboardStore();
```

## Styling

Uses Tailwind CSS with dark mode customization:
- Dark background: `#030712` (gray-950)
- Dark cards: `gray-900/50`
- Status colors: green (healthy), yellow (warning), red (critical), blue (info), purple (AI)

## Type Safety

All components are fully typed with TypeScript. See `src/types/index.ts` for data models.

## Docker

Build Docker image:

```bash
docker build -t ki-engine-web:latest .
```

Run:

```bash
docker run -p 80:80 ki-engine-web:latest
```

## Contributing

1. Follow TypeScript strict mode
2. Use React functional components with hooks
3. Keep components small and reusable
4. Use Zustand for global state
5. Use React Query for server state

## License

Proprietary - Kubernetes Incident Intelligence Engine
