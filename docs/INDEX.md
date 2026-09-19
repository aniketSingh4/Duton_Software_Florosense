# Duton reference docs

Read these in order if you are new to the codebase. Each file has diagrams you can follow without opening every source file.

| # | File | Purpose |
|---|------|---------|
| 1 | [01-system-overview.md](01-system-overview.md) | Big picture: two folders, roles, features, data stores |
| 2 | [02-frontend-guide.md](02-frontend-guide.md) | `duton-frontend` entry point, pages, components, API client |
| 3 | [03-backend-guide.md](03-backend-guide.md) | `duton-backend` entry point, routes, services, MongoDB |
| 4 | [04-development-guide.md](04-development-guide.md) | Local setup, env vars, request walkthrough, where to add features |
| 5 | [05-concepts-frameworks-workflow.md](05-concepts-frameworks-workflow.md) | Frameworks, domain concepts, folder “why”, end-to-end workflows |
| SOP | [DUTON-SOP-Development-Runbook.pdf](DUTON-SOP-Development-Runbook.pdf) | Printable SOP: run steps, code extracts, purpose of each file |

## What this product is

**Duton** is the operator dashboard for Florosense air monitors. Staff and clients log in, pick a sensor, watch live PM2.5 / PM10 / temperature / humidity, raise tickets, track AMC, and download history.

- **Frontend** = what you see in the browser (`duton-frontend`)
- **Backend** = REST API, MongoDB, background jobs (`duton-backend`)
- **Florosense cloud** = external device API that supplies live and historical readings

## Entry points (one-line)

```
Browser  →  duton-frontend/src/app/layout.js   (wraps every page)
         →  duton-frontend/src/app/page.js     (redirects to /login)

API      →  duton-backend/src/server.js        (Express app, mounts all routes)
         →  duton-backend/src/config.js        (loads .env, then server starts)
```
