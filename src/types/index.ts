export type EntityId = number | string;

export type PaginatedResponse<T> = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
};

export type CollectionResponse<T> = T[] | PaginatedResponse<T>;

export type ApiParams = Record<string, string | number | boolean | null | undefined>;

export type AppUser = {
  id: number;
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string | null;
  full_name?: string | null;
  role?: 'admin' | 'manager' | string;
  is_superuser?: boolean;
  is_staff?: boolean;
  avatar?: string | null;
  avatar_url?: string | null;
  dob?: string | null;
  social_contacts?: string | null;
  job_description?: string | null;
  work_status?: string | null;
  is_effective?: boolean;
  office?: {
    id?: number;
    city?: string | null;
    address?: string | null;
    phone?: string | null;
  } | null;
  managersalary?: {
    monthly_plan?: number | null;
    current_month_revenue?: number | null;
    current_balance?: number | null;
    fixed_salary?: number | null;
    motivation_target?: number | null;
    motivation_reward?: number | null;
  } | null;
  access_profile?: {
    id?: number;
    can_view_office_dashboard?: boolean;
    can_be_in_leaderboard?: boolean;
    managed_office?: {
      id: number;
      city?: string | null;
      address?: string | null;
    } | null;
  } | null;
};

export type AuthTokens = {
  access: string;
  refresh?: string;
};

export type AuthResponse = Partial<AuthTokens> & {
  user?: AppUser;
  detail?: string;
};

export type Workday = {
  id?: EntityId;
  status?: string;
  started_at?: string | null;
  closed_at?: string | null;
  date?: string;
  total_minutes?: number | null;
};

export type DashboardSummary = {
  workday: Workday | null;
  stats: {
    leads: number;
    clients: number;
    tasks: number;
    deals: number;
    notifications: number;
  };
  warnings: string[];
};

export type ApiListItem = {
  id?: EntityId;
  title?: string;
  name?: string;
  full_name?: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
};
