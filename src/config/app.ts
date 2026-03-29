export const APP_CONFIG = {
  appName: 'ManagerSL',
  companyName: "Students Life",
  domain: 'https://manager-sl.ru',
  apiBaseUrl: 'https://manager-sl.ru/api/',
  supportEmail: 'begenchyagmurow2008@gmail.com',
};

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
