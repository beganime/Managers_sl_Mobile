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

Current app behavior: Sprint 1 profile screen reads the current user only and does not submit profile edits.
