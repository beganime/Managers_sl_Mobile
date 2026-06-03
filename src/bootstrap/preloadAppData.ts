import { getMe } from '../api/auth';
import { listClients } from '../api/crm';
import { listUniversities } from '../api/education';
import { listProjectTasks } from '../api/projects';

export async function preloadAppData() {
  try {
    await getMe();
  } catch {
  }

  await Promise.allSettled([
    listClients({ limit: 100 }),
    listProjectTasks({ limit: 100 }),
    listUniversities({ limit: 100 }),
  ]);
}
