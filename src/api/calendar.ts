import { extractItems, getJson, toApiError, v1 } from './client';
import { listProjectTasks } from './projects';

export type CalendarAgendaItem = {
  id: string;
  title: string;
  subtitle?: string;
  date?: string;
  type: 'event' | 'task' | 'workday';
  status?: string;
  route?: string;
};

export type CalendarAgenda = {
  items: CalendarAgendaItem[];
  warnings: string[];
};

export type CalendarParams = {
  month?: number;
  year?: number;
  date?: string;
};

type CalendarEventRecord = {
  id?: string | number;
  title?: string;
  name?: string;
  description?: string;
  event_date?: string;
  date?: string;
  start?: string;
  start_date?: string;
  deadline?: string;
  birthday?: string;
  start_time?: string;
  end_time?: string;
  visibility?: string;
  type?: string;
  event_type?: string;
  status?: string;
};

function getMonthRange(params?: CalendarParams) {
  const now = params?.date ? new Date(params.date) : new Date();
  const year = params?.year || now.getFullYear();
  const month = params?.month || now.getMonth() + 1;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  return {
    year,
    month,
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: end.toISOString().slice(0, 10),
  };
}

function getEventDate(event: CalendarEventRecord) {
  return event.event_date || event.date || event.start || event.start_date || event.deadline || event.birthday;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function collectCalendarRecords(payload: unknown): CalendarEventRecord[] {
  if (Array.isArray(payload)) return payload as CalendarEventRecord[];
  if (!isRecord(payload)) return [];

  const direct = extractItems<CalendarEventRecord>(payload);
  if (direct.length) return direct;

  const records: CalendarEventRecord[] = [];

  ['events', 'items', 'data', 'results'].forEach((key) => {
    const value = payload[key];
    if (Array.isArray(value)) records.push(...(value as CalendarEventRecord[]));
  });

  const days = payload.days || payload.month_days || payload.calendar;
  if (Array.isArray(days)) {
    days.forEach((day) => {
      if (!isRecord(day)) return;

      const dayDate = String(day.date || day.day || '');
      const dayEvents = day.events || day.items;

      if (!Array.isArray(dayEvents)) return;

      dayEvents.forEach((event) => {
        if (isRecord(event)) {
          records.push({ ...(event as CalendarEventRecord), date: String(event.date || event.event_date || dayDate) });
        }
      });
    });
  }

  return records;
}

async function listBackendCalendarEvents(params?: CalendarParams): Promise<CalendarAgenda | null> {
  const range = getMonthRange(params);
  const candidates = [
    {
      path: v1('/calendar/month/'),
      params: {
        month: range.month,
        year: range.year,
      },
    },
    {
      path: v1('/calendar/events/'),
      params: {
        limit: 300,
        month: range.month,
        year: range.year,
        date_from: range.dateFrom,
        date_to: range.dateTo,
      },
    },
  ];

  for (const candidate of candidates) {
    try {
      const payload = await getJson(candidate.path, { params: candidate.params });
      const events = collectCalendarRecords(payload);

      return {
        items: events.map((event) => {
          const id = String(event.id || `${getEventDate(event)}-${event.title || event.name}`);

          return {
            id: `event-${id}`,
            title: event.title || event.name || 'Событие',
            subtitle: [event.start_time, event.end_time, event.description].filter(Boolean).join(' - '),
            date: getEventDate(event),
            type: 'event',
            status: event.status || event.event_type || event.type || event.visibility || 'calendar',
          };
        }),
        warnings: [],
      };
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.status === 404) continue;
      throw apiError;
    }
  }

  return null;
}

async function buildFallbackAgenda(params?: CalendarParams): Promise<CalendarAgenda> {
  const range = getMonthRange(params);
  const tasksResult = await Promise.allSettled([
    listProjectTasks({ limit: 120, offset: 0, date_from: range.dateFrom, date_to: range.dateTo }),
  ]);

  const warnings: string[] = [
    'Календарь временно собирается из задач. Рабочий день не добавляется как событие.',
  ];
  const items: CalendarAgendaItem[] = [];
  const tasksPromise = tasksResult[0];

  if (tasksPromise.status === 'fulfilled') {
    const tasks = extractItems<Record<string, unknown>>(tasksPromise.value);

    tasks
      .filter((task) => Boolean(task.deadline || task.due_date || task.end_date))
      .forEach((task) => {
        const id = String(task.id || task.pk || '');

        items.push({
          id: `task-${id}`,
          title: String(task.title || task.name || 'Задача'),
          subtitle: String(task.project_title || task.project_name || task.priority || ''),
          date: String(task.deadline || task.due_date || task.end_date || ''),
          type: 'task',
          status: String(task.status || 'todo'),
          route: id ? `/(app)/tasks-v2/${id}` : undefined,
        });
      });
  } else {
    warnings.push(toApiError(tasksPromise.reason).message);
  }

  return {
    items,
    warnings,
  };
}

function sortAgenda(agenda: CalendarAgenda) {
  agenda.items.sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  return agenda;
}

export async function listCalendarEvents(params?: CalendarParams): Promise<CalendarAgenda> {
  const backendAgenda = await listBackendCalendarEvents(params);
  return sortAgenda(backendAgenda || (await buildFallbackAgenda(params)));
}
