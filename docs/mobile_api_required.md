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

## Final Mobile Sprint: Dashboard, Documents, Notifications, Knowledge

Mobile now uses existing APIs first and does not invent separate backend URLs.

Current mobile behavior:

- Workday dashboard uses `GET /api/v1/attendance/workdays/today/`, `POST /api/v1/attendance/workdays/start/`, `POST /api/v1/attendance/workdays/report/`, `POST /api/v1/attendance/workdays/close/`.
- Workday history uses `GET /api/v1/attendance/reports/` with optional `employee`/`user` params.
- Admin dashboard table is built from available report records. Full "all employees today" parity needs a team workday endpoint if reports do not include all staff.
- Notifications list/read uses confirmed `GET /api/v1/notifications/`, `POST /api/v1/notifications/{id}/mark-read/`, `POST /api/v1/notifications/mark-all-read/`.
- Notification create screen sends `POST /api/v1/notifications/` only from the admin UI and shows a clear server note if the endpoint returns `404/405`.
- Documents approval uses existing generated/approval approve endpoints and sends stamp fields in the payload.
- Education cards read optional image fields and work with null values.
- Knowledge article create screen sends `POST /api/v1/knowledge/articles/` and shows a clear server note if creation is not enabled.

Required if production backend does not already support these contracts:

- `GET /api/v1/attendance/reports/?employee={id}` or `?user={id}` — employee report history for admin and personal history for staff.
- `GET /api/v1/attendance/workdays/today/team/` — admin table for employees who started/reported/closed the current workday.
- `POST /api/v1/notifications/` — create notification with `target`, `recipient_id`/`user_id`, `office_id`, `send_to_all`, `title`, `body`, `notification_type`.
- `GET /api/v1/documents/generated/{id}/preview/` or `preview_url`/`pdf_preview_url` in `GET /api/v1/documents/generated/{id}/` — mobile document preview before approval.
- `POST /api/v1/documents/generated/{id}/approve/` and `POST /api/v1/documents/approvals/{id}/approve/` should accept stamp fields: `stamp_position`, `width_mm`, `height_mm`, `x_mm`, `y_mm`.
- `POST /api/v1/knowledge/articles/` — create article with `title`, `content`, `category_id`, `visibility`, `selected_users`.
- Education image fields in countries/cities/universities responses: `image_url`, `cover_image_url`, `logo_url`, `flag_url`.
- `GET /api/v1/calendar/events/` should support `month`, `year`, `date_from`, `date_to` and include events, birthdays, deadlines and important dates. Workday should not be returned as a calendar event.

## Final Bugfix/Polish Sprint Audit

Mobile now uses these safe fallbacks and documented response fields:

- Education images resolve absolute URLs and relative `/media/...` paths from `cover_image_url`, `logo_url`, `image_url`, `flag_url`, plus raw `cover_image`, `logo`, `image`, `flag` fields.
- University API tries `GET /api/v1/education/universities/` first, then `GET /api/client/v1/universities/` only after a 404.
- Calendar tries `GET /api/v1/calendar/month/?year=YYYY&month=MM`, then `GET /api/v1/calendar/events/?year=YYYY&month=MM&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`; if both are absent, it falls back to task deadlines only and never shows workday as an event.
- Admin workday table now reads `GET /api/v1/attendance/workdays/?date=YYYY-MM-DD` plus `GET /api/v1/attendance/reports/?date=YYYY-MM-DD`.
- Notification create loads recipients from `GET /api/v1/users/`, then `GET /api/v1/employees/`, then the existing legacy `GET /api/users/users/`.
- Notification create sends `POST /api/v1/notifications/` with `user_id`/`recipient_id` for one user or `send_to_all=true` for all employees.
- Documents open preview from `preview_url`, `pdf_preview_url`, `preview_file_url`, or available document file URLs; text preview uses `preview_text`, `text_preview`, `document_text`, `rendered_text`, `content`, `body`.
- Documents show DOCX without approval from `generated_file_url`, `docx_url`, `download_docx_url`, `original_file_url`, `file_url`, or `download_url`.
- Approved PDF with stamp is shown from `approved_file_url`, `approved_pdf_url`, `sealed_pdf_url`, `pdf_url`, or `stamped_pdf_url`.
- Document approve sends stamp settings as `stamp_position`, `position`, `width_mm`, `height_mm`, `x_mm`, `y_mm`, `unit`.
- Rating hides employees for regular users when any of these fields explicitly disable leaderboard visibility: `can_be_in_leaderboard`, `is_in_leaderboard`, `show_in_rating`, `rating_enabled`, `employee.access.can_be_in_leaderboard`, `employee_profile.access.can_be_in_leaderboard`, `access_profile.can_be_in_leaderboard`.

Production backend gaps if any of the above fields/routes are missing:

- `GET /api/v1/calendar/month/` or `GET /api/v1/calendar/events/` with month/date range filters and day/event payloads.
- `GET /api/v1/users/` or `GET /api/v1/employees/` for mobile notification recipient selection.
- `POST /api/v1/notifications/` with `send_to_all=true` for sending to every employee.
- Document detail responses should include either preview text fields or preview/download URLs for mobile review before approval.
- Document approve endpoints should accept stamp size/position fields in millimeters.
- Rating responses should include leaderboard visibility fields and score fields (`score`, `rating`, `rating_score`, or `points`).

## Backend Support API Update

Implemented in backend branch `rebuild-erp-core` for the mobile app:

- `GET /api/v1/documents/generated/{id}/preview/`
- `GET /api/v1/documents/generated/{id}/download-docx/`
- `GET /api/v1/documents/generated/{id}/download-pdf/`
- document generated/detail responses include `preview_url`, `download_docx_url`, `download_pdf_url`, `approved_pdf_url`, `original_docx_url`, `can_download_docx`, `can_download_pdf`, `can_preview`, `can_approve`, `can_reject`.
- document approve endpoints accept `stamp_position`, `stamp_width_mm`, `stamp_height_mm`, `stamp_x_mm`, `stamp_y_mm`, plus `width_mm`, `height_mm`, `x_mm`, `y_mm` aliases.
- `GET /api/v1/rating/` filters hidden leaderboard users by default; admins can request `?include_hidden=1`.
- rating rows include `can_be_in_leaderboard`, `is_hidden_from_rating`, `score`, `rating_score`, `points`.
- country/city API responses include `image_url`, `cover_image_url`; countries also include `flag_url`.
- client university API includes public contacts, `contact_people`, `fees_summary`, `email`, `phone`, `address`, public admission/living fields and program data.
- `GET /api/v1/attendance/workdays/history/` returns workday history with start/close/report text.
- `GET /api/v1/calendar/month/?year=YYYY&month=MM` returns full month events.
- `GET /api/v1/calendar/events/?date=YYYY-MM-DD` and month/date range calls include employee birthdays as `type=birthday`.

Remaining mobile/backend gaps after this pass:

- `GET /api/v1/users/` or `GET /api/v1/employees/` should be confirmed for notification recipient selection if the legacy users endpoint is removed later.
- `POST /api/v1/notifications/` with `send_to_all=true` should stay supported for mobile "send to all employees".
