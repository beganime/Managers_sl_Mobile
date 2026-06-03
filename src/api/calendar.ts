import { getTodayWorkday } from './attendance';
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

type CalendarEventRecord = {
  id?: string | number;
  title?: string;
  description?: string;
  event_date?: string;
  start_time?: string;
  end_time?: string;
  visibility?: string;
};

async function listBackendCalendarEvents(): Promise<CalendarAgenda | null> {
  try {
    const payload = await getJson(v1('/calendar/events/'), {
      params: {
        limit: 100,
        date_from: new Date().toISOString().slice(0, 10),
      },
    });
    const events = extractItems<CalendarEventRecord>(payload);

    return {
      items: events.map((event) => ({
        id: `event-${event.id}`,
        title: event.title || 'Событие',
        subtitle: [event.start_time, event.end_time, event.description].filter(Boolean).join(' - '),
        date: event.event_date,
        type: 'event',
        status: event.visibility || 'calendar',
      })),
      warnings: [],
    };
  } catch (error) {
    const apiError = toApiError(error);
    if (apiError.status === 404) return null;
    throw apiError;
  }
}

async function buildFallbackAgenda(): Promise<CalendarAgenda> {
  const [tasksResult, workdayResult] = await Promise.allSettled([
    listProjectTasks({ limit: 80, offset: 0 }),
    getTodayWorkday(),
  ]);

  const warnings: string[] = [
    'Calendar API ещё не доступен на сервере. Agenda временно собирается из задач и attendance.',
  ];
  const items: CalendarAgendaItem[] = [];

  if (tasksResult.status === 'fulfilled') {
    const tasks = extractItems<Record<string, unknown>>(tasksResult.value);

    tasks
      .filter((task) => Boolean(task.deadline))
      .forEach((task) => {
        const id = String(task.id || task.pk || '');

        items.push({
          id: `task-${id}`,
          title: String(task.title || task.name || 'Задача'),
          subtitle: String(task.project_title || task.project_name || task.priority || ''),
          date: String(task.deadline || ''),
          type: 'task',
          status: String(task.status || 'todo'),
          route: id ? `/(app)/tasks-v2/${id}` : undefined,
        });
      });
  } else {
    warnings.push(toApiError(tasksResult.reason).message);
  }

  if (workdayResult.status === 'fulfilled' && workdayResult.value) {
    const workday = workdayResult.value;

    items.unshift({
      id: `workday-${workday.id || workday.date || 'today'}`,
      title: 'Рабочий день',
      subtitle: workday.started_at ? 'День начат' : 'День ещё не начат',
      date: workday.date || new Date().toISOString(),
      type: 'workday',
      status: workday.status || 'not_started',
      route: '/(app)/workday',
    });
  } else if (workdayResult.status === 'rejected') {
    warnings.push(toApiError(workdayResult.reason).message);
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

export async function listCalendarEvents(): Promise<CalendarAgenda> {
  const backendAgenda = await listBackendCalendarEvents();
  return sortAgenda(backendAgenda || (await buildFallbackAgenda()));
}
