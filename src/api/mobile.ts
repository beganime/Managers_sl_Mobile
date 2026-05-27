export type { AppUser } from '../types';
export { getDashboardSummary as getDashboard } from './dashboard';
export { getMe as getCurrentUser, login, logout } from './auth';
export {
  createClient,
  createLead,
  listApplications,
  listClients,
  listLeads,
} from './crm';
export { listUniversities } from './education';
export { closeWorkday as endDay, getTodayWorkday as getCurrentShift, startWorkday as startDay } from './attendance';
export { listProjectTasks as getTasks, createProjectTask as createTask } from './projects';
