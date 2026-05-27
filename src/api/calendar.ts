import { createMissingEndpointError } from './client';

export async function listCalendarEvents() {
  throw createMissingEndpointError('календаря', 'GET /api/v1/calendar/events/');
}
