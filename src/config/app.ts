export const APP_CONFIG = {
  appName: 'ManagerSL',
  companyName: "Students Life",
  domain: 'https://students-life.ru/api1',
  apiBaseUrl: 'https://students-life.ru/api1',
  apiFallbackBaseUrl: 'https://manager-sl.ru',
  supportEmail: 'begenchyagmurow2008@gmail.com',
};

export const SERVICE_URLS = {
  tasks: 'https://task.manager-sl.ru',
  translate: 'https://translate.manager-sl.ru',
  disk: 'https://disk.manager-sl.ru',
  exams: 'https://exam.stud-life.com',
  managerWeb: 'https://manager-sl.ru',
} as const;

export const STORAGE_KEYS = {
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
  cachedProfile: 'cache_my_profile',
  cachedDashboard: 'cache_dashboard',
  cachedClients: 'cache_clients',
  cachedUniversities: 'cache_universities',
  cachedTasks: 'cache_tasks',
  offlineTasks: 'offline_tasks',
  theme: 'app_theme',
} as const;
