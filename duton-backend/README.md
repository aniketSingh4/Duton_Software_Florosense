# Duton Ticket Backend - Node.js Version

A standalone Express.js service dedicated to managing support tickets. It persists tickets and replies in MongoDB (configured via `NEW_DB_URL`) and exposes a REST API under `/api/tickets`.

## Features

- Create, list, update, and retrieve support tickets
- Optional filtering by status, priority, sensor, and search term
- Threaded replies per ticket
- Image upload support (stored as base64 in MongoDB)
- MongoDB persistence via native MongoDB driver

## Requirements

- Node.js (v18 or higher)
- MongoDB connection string (set in `NEW_DB_URL`)

## Setup

```bash
cd ticket-backend
npm install
```

Create a `.env` file and set at least:

```env
NEW_DB_URL=mongodb+srv://user:pass@cluster.example.com/?retryWrites=true&w=majority
TICKET_DB_NAME=duton_tickets
```

## Running locally

```bash
npm start        # Production mode
npm run dev      # Development mode (with auto-reload)
```

By default the API is available at `http://127.0.0.1:8001/api/tickets`. Adjust `TICKET_HOST`, `TICKET_PORT`, and `TICKET_DEBUG` in the `.env` file if needed.

## API overview

- `GET /api/tickets` – list tickets (supports `status`, `priority`, `sensor_id`, `search` query params)
- `POST /api/tickets` – create a ticket (supports JSON or multipart/form-data with image)
- `GET /api/tickets/:ticket_id` – fetch a single ticket with replies
- `PATCH /api/tickets/:ticket_id` – update fields such as status/assignee
- `POST /api/tickets/:ticket_id/replies` – add a reply to a ticket

