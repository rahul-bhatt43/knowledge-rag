# Company Knowledge Management Backend

A scalable Node.js/Express/MongoDB/TypeScript backend for company knowledge management, featuring role-based access control (RBAC), templates, projects, RACI assignments, real-time sockets, and background jobs.

## Quick Start

1. Clone/setup the repo.
2. Copy `.env.example` to `.env` and configure (e.g., MongoDB URI).
3. Install dependencies: `npm install`
4. Build & Run: `npm run build && npm start` or `npm run dev` for development.
5. Tests: `npm test`

## Structure Overview
- `src/config/`: Environment, DB, Socket configs.
- `src/models/`: Mongoose schemas (User, Project, Template, etc.).
- `src/controllers/`: HTTP handlers.
- `src/services/`: Business logic (e.g., seeding templates to projects).
- `src/middlewares/`: Auth, RBAC, validation.
- `src/routes/`: API endpoints.
- `src/sockets/`: Real-time handlers for tasks/notifications.
- `src/jobs/`: BullMQ queues for emails, cleanups.

## Key Features
- Roles: Founder (full), Admin (org-level), Manager (FA-assigned), Staff.
- Templates: Hierarchical (FA > Phases > Tasks > RACI).
- Projects: Seeded from templates, editable by admins.
- RBAC: Middleware enforces permissions.
- Real-time: Socket.io for notifications/tasks.
- Jobs: Background processing with BullMQ.

For schemas/models, implement based on relationships (e.g., Template hasMany FunctionalArea, each with RACI refs to FAs).