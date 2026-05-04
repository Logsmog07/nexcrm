## CRM Analytics & Sales Intelligence System Structure

```text
CRM Project/
├── backend/
│   ├── index.js
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── db/
│   │   │   └── migrations/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── modules/
│   │   │   ├── activities/
│   │   │   ├── analytics/
│   │   │   ├── auth/
│   │   │   ├── customers/
│   │   │   ├── deals/
│   │   │   ├── leads/
│   │   │   ├── notifications/
│   │   │   └── users/
│   │   ├── repositories/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── validators/
│   └── tests/
├── db/
├── docs/
│   └── project-structure.md
├── frontend/
│   ├── public/
│   │   ├── icons/
│   │   └── images/
│   └── src/
│       ├── api/
│       ├── app/
│       ├── assets/
│       ├── components/
│       │   ├── charts/
│       │   ├── common/
│       │   ├── forms/
│       │   ├── kanban/
│       │   ├── layout/
│       │   ├── tables/
│       │   └── ui/
│       ├── features/
│       │   ├── activities/
│       │   ├── analytics/
│       │   ├── auth/
│       │   ├── customers/
│       │   ├── dashboard/
│       │   ├── deals/
│       │   ├── leads/
│       │   └── notifications/
│       ├── hooks/
│       ├── lib/
│       ├── pages/
│       ├── router/
│       ├── store/
│       ├── styles/
│       └── utils/
├── node_modules/
├── package-lock.json
└── package.json
```

### Backend ownership

- `config/`: environment, database pool, app constants
- `controllers/`: request-response handlers
- `middleware/`: auth, RBAC, validation, error handling
- `repositories/`: SQL access layer
- `services/`: business logic and analytics calculations
- `modules/`: domain-focused feature grouping for auth, leads, customers, deals, activities, analytics, notifications
- `db/migrations/`: SQL schema and seed scripts

### Frontend ownership

- `api/`: Axios client and per-domain API modules
- `app/`: providers, app shell, theme bootstrap
- `components/`: reusable UI building blocks
- `features/`: feature-scoped state and smart UI
- `pages/`: route-level screens
- `router/`: protected routing and navigation config
- `store/`: Zustand global stores
- `styles/`: design tokens and global style layers
