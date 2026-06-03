# Mobile API Required

Sprint 1 does not invent backend URLs when an endpoint was not confirmed.

## Calendar

Required for the mobile "Календарь" section:

- `GET /api/v1/calendar/events/` — list calendar events for the authenticated user.
- Optional later endpoints for Sprint 2+: `POST /api/v1/calendar/events/`, `PATCH /api/v1/calendar/events/{id}/`, `DELETE /api/v1/calendar/events/{id}/`.

Current app behavior: the route is present in the new navigation and shows a documented API error instead of calling an unconfirmed URL.

## Profile Editing

The provided Sprint 1 endpoint list confirms `GET /api/v1/me/`.
For profile editing and avatar updates in later sprints, confirm one of these contracts:

- `PATCH /api/v1/me/`
- `PATCH /api/v1/profile/`
- dedicated avatar upload/remove endpoints.

Current app behavior: Sprint 2 uses the existing backend fallback `GET/PATCH /api/users/users/me/` after `/api/v1/me/` returns 404.

## Mobile Auth/Profile/Dashboard

Backend `students_life/urls.py` currently has:

- `POST /api/auth/login/`
- `POST /api/auth/refresh/`
- `POST /api/auth/logout/`
- `GET /api/app/dashboard/`
- `/api/v1/crm/`, `/api/v1/education/`, `/api/v1/services/`, `/api/v1/finance/`, `/api/v1/attendance/`, `/api/v1/projects/`, `/api/v1/knowledge/`, `/api/v1/notifications/`

Missing mobile-friendly endpoints documented in `api_doc.md` but not mounted yet:

- `GET /api/v1/me/`
- `PATCH /api/v1/me/`
- `GET /api/v1/dashboard/`
- `GET /api/v1/mobile/bootstrap/`
- `GET /api/v1/mobile/search/?q=...`

Current app behavior: auth uses `/api/auth/...`; profile falls back to `/api/users/users/me/`; dashboard is composed from existing `/api/v1/...` resources and can fall back to `/api/app/dashboard/`.

Live check on `https://manager-sl.ru` during Sprint 2:

- `GET /api/v1/me/` returned `404`.
- `GET /api/v1/dashboard/` returned `404`.
- `GET /api/users/users/me/` returned `401`, which confirms the URL exists and requires auth.
- `GET /api/app/dashboard/` returned `401`, which confirms the URL exists and requires auth.
- `GET /api/v1/crm/leads/`, `/api/v1/crm/clients/`, `/api/v1/education/universities/`, `/api/v1/finance/incomes/`, `/api/v1/projects/tasks/`, `/api/v1/attendance/workdays/today/` returned `401`, which confirms the URLs exist and require auth.

## Incoming Leads Ownership

CRM leads exist at `GET/POST /api/v1/crm/leads/`, but there is no confirmed endpoint for "take responsibility" on an incoming lead.

Required for the mobile "Входящие" responsibility action:

- `POST /api/v1/crm/leads/{id}/take/`

Current app behavior: incoming leads are shown from `/api/v1/crm/leads/?status=new`, while the responsibility action displays a clear "soon available" message instead of calling an unconfirmed URL.

## CRM Documents Shortcut

Document templates and generated documents exist under `/api/v1/documents/`. A direct "create document for client" shortcut endpoint is not confirmed.

Required for one-tap client document creation:

- `POST /api/v1/documents/templates/{template_id}/generate/` with a documented `client` payload, or
- a dedicated `POST /api/v1/crm/clients/{id}/documents/`.

Current app behavior: client cards show the document action only as navigation context for later document sprint; no unconfirmed URL is called.

## Sprint 3 Projects, Education, Services, Knowledge

Confirmed in backend routing and used by the mobile app:

- `GET/POST /api/v1/projects/`
- `GET/PATCH /api/v1/projects/{id}/`
- `GET/POST /api/v1/projects/tasks/`
- `GET/PATCH /api/v1/projects/tasks/{id}/`
- `POST /api/v1/projects/tasks/{id}/complete_task/`
- `POST /api/v1/projects/tasks/{id}/reopen_task/`
- `POST /api/v1/projects/tasks/{id}/add_comment/`
- `GET /api/v1/projects/comments/?task={id}`
- `GET /api/v1/education/universities/`
- `GET /api/v1/education/universities/{id}/`
- `GET /api/v1/education/programs/`
- `GET /api/v1/education/programs/{id}/`
- `GET /api/v1/services/categories/`
- `GET /api/v1/services/services/`
- `GET /api/v1/services/services/{id}/`
- `GET /api/v1/services/prices/`
- `GET /api/v1/knowledge/categories/`
- `GET /api/v1/knowledge/articles/`
- `GET /api/v1/knowledge/articles/{id}/`
- `POST /api/v1/knowledge/articles/{id}/mark-read/`

Important Sprint 3 correction: the old mobile wrapper used `GET /api/v1/knowledge/folders/`.
Backend exposes knowledge categories, not folders, so the app now calls `GET /api/v1/knowledge/categories/`.

Still missing for Sprint 3 calendar:

- `GET /api/v1/calendar/events/`
- `POST /api/v1/calendar/events/`
- `PATCH /api/v1/calendar/events/{id}/`
- `DELETE /api/v1/calendar/events/{id}/`

## Backend Completion Pass

This section supersedes earlier "missing endpoint" notes after backend `rebuild-erp-core` changes.

Added for mobile parity:

- `GET/PATCH /api/v1/me/`
- `GET /api/v1/dashboard/`
- `GET /api/v1/mobile/bootstrap/`
- `GET /api/v1/mobile/search/?q=...`
- `GET /api/v1/rating/`
- `GET/POST /api/v1/calendar/events/`
- `GET/PATCH/DELETE /api/v1/calendar/events/{id}/`

Already confirmed and now used by mobile:

- `POST /api/v1/crm/leads/{id}/take/`
- `GET /api/v1/crm/incoming-leads/`

Current remaining backend gap for Sprint 1-5 mobile functionality:

- None in source code. Production still needs the backend branch deployed to `https://manager-sl.ru`.

Current app behavior: Tasks, Projects, Education, Services and Knowledge use confirmed endpoints. Calendar remains a documented shell and shows "Раздел скоро будет доступен" instead of calling an unconfirmed URL.

## Sprint 4 Finance, Documents, Rating, Notifications

Confirmed in backend routing and used by the mobile app:

- `GET /api/v1/finance/cashboxes/`
- `GET /api/v1/finance/deals/`
- `GET /api/v1/finance/deals/{id}/`
- `GET/POST /api/v1/finance/incomes/`
- `GET /api/v1/finance/incomes/{id}/`
- `POST /api/v1/finance/incomes/{id}/confirm/`
- `POST /api/v1/finance/incomes/{id}/reject/`
- `GET/POST /api/v1/finance/expenses/`
- `GET /api/v1/finance/expenses/{id}/`
- `POST /api/v1/finance/expenses/{id}/confirm/`
- `GET /api/v1/finance/transactions/`
- `GET /api/v1/finance/transactions/{id}/`
- `GET /api/v1/finance/expense-categories/`
- `GET /api/v1/documents/templates/`
- `GET /api/v1/documents/templates/{id}/`
- `POST /api/v1/documents/templates/{id}/generate/`
- `GET /api/v1/documents/generated/`
- `GET /api/v1/documents/generated/{id}/`
- `POST /api/v1/documents/generated/{id}/generate/`
- `POST /api/v1/documents/generated/{id}/submit-for-approval/`
- `POST /api/v1/documents/generated/{id}/approve/`
- `POST /api/v1/documents/generated/{id}/reject/`
- `GET /api/v1/documents/approvals/`
- `GET /api/v1/documents/approvals/{id}/`
- `POST /api/v1/documents/approvals/{id}/approve/`
- `POST /api/v1/documents/approvals/{id}/reject/`
- `GET /api/v1/notifications/`
- `GET /api/v1/notifications/{id}/`
- `POST /api/v1/notifications/{id}/mark-read/`
- `POST /api/v1/notifications/mark-all-read/`

Rating note:

- `GET /api/v1/rating/` was listed in the mobile target API but is not mounted in `students_life/urls.py`.
- Existing backend leaderboard is available at `GET /api/gamification/leaderboard/`.

Current app behavior: mobile rating first tries `GET /api/v1/rating/` and safely falls back to `GET /api/gamification/leaderboard/` only after a 404. This fallback is documented and does not hide other API errors.

## Sprint 5 Education, Calendar, Push

Confirmed in backend `rebuild-erp-core` routing and used by the mobile app:

- `GET /api/v1/education/countries/`
- `GET /api/v1/education/cities/`
- `GET /api/v1/education/currencies/`
- `GET /api/v1/education/universities/`
- `GET /api/v1/education/universities/{id}/`
- `GET /api/v1/education/programs/`
- `GET /api/v1/education/programs/{id}/`
- `POST /api/v1/notifications/device-tokens/register/`
- `POST /api/v1/notifications/device-tokens/unregister/`

Education app behavior:

- The mobile Education section now has separate tabs for countries, cities, universities and programs.
- Countries and cities are loaded from the same backend admin data as universities and programs.
- University lists can be filtered by country and city.
- Program lists can be filtered by country and degree, matching backend `ProgramViewSet` filters.

Calendar app behavior:

- `GET /api/v1/calendar/events/` is still not mounted in backend API.
- Backend has portal calendar models and web views, but no confirmed mobile API route yet.
- The mobile Calendar screen now composes a safe agenda from confirmed endpoints:
  - `GET /api/v1/projects/tasks/`
  - `GET /api/v1/attendance/workdays/today/`
- No unconfirmed calendar URL is called.

Still required for full portal calendar parity:

- `GET /api/v1/calendar/events/`
- `POST /api/v1/calendar/events/`
- `PATCH /api/v1/calendar/events/{id}/`
- `DELETE /api/v1/calendar/events/{id}/`
