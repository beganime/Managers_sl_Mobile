import apiClient, { fetchAllPages } from '../api/apiClient';
import { saveToken } from '../utils/storage';

async function saveJson(key: string, value: any) {
  try {
    await saveToken(key, JSON.stringify(value));
  } catch {}
}

export async function preloadAppData() {
  try {
    const me = await apiClient.get('users/users/me/');
    await saveJson('cache_my_profile', me.data);
  } catch {}

  const [clients, tasks, universities] = await Promise.allSettled([
    fetchAllPages('clients/'),
    fetchAllPages('tasks/'),
    fetchAllPages('catalog/universities/'),
  ]);

  if (clients.status === 'fulfilled') {
    await saveJson('cache_clients', clients.value);
  }

  if (tasks.status === 'fulfilled') {
    await saveJson('cache_tasks', tasks.value);
  }

  if (universities.status === 'fulfilled') {
    await saveJson('cache_universities', universities.value);
    await saveJson('cache_universities_full', universities.value);
  }
}