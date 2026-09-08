# Duton / Florosense

Air-quality monitoring platform: a Next.js dashboard and an Express API that together manage sensors, live PM readings, sites, support tickets, AMC/warranty, calibration, alerts, and documents.

```
Duton_Software_Florosense/
├── duton-frontend/     Next.js 16 dashboard (port 3000)
├── duton-backend/      Express + MongoDB API (port 8001)
└── docs/               Architecture and development reference
```

## Start here

| Document | What it covers |
|----------|----------------|
| [docs/INDEX.md](docs/INDEX.md) | Index of all reference docs |
| [docs/01-system-overview.md](docs/01-system-overview.md) | How both folders work together (diagrams) |
| [docs/02-frontend-guide.md](docs/02-frontend-guide.md) | Frontend entry point, routes, folder map |
| [docs/03-backend-guide.md](docs/03-backend-guide.md) | Backend entry point, APIs, folder map |
| [docs/04-development-guide.md](docs/04-development-guide.md) | How to run locally and how a request flows |
| [docs/05-concepts-frameworks-workflow.md](docs/05-concepts-frameworks-workflow.md) | Frameworks, domain concepts, workflows |

## Quick start

**Backend** (from `duton-backend/`):

```bash
cp .env.example .env   # then fill MongoDB, JWT, Florosense keys
npm install
npm run dev            # http://127.0.0.1:8001
```

**Frontend** (from `duton-frontend/`):

```bash
npm install
npm run dev            # http://localhost:3000  →  redirects to /login
```

The UI talks to the API at `http://localhost:8001` in development.
