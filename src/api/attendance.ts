import { ApiParams, Workday } from '../types';
import { getJson, postJson, v1 } from './client';

export function getTodayWorkday() {
  return getJson<Workday | null>(v1('/attendance/workdays/today/'));
}

export function startWorkday(payload?: Record<string, unknown>) {
  return postJson<Workday>(v1('/attendance/workdays/start/'), payload || {});
}

export function getWorkdayReport(params?: ApiParams) {
  return getJson(v1('/attendance/workdays/report/'), { params });
}

export function closeWorkday(payload?: Record<string, unknown>) {
  return postJson<Workday>(v1('/attendance/workdays/close/'), payload || {});
}
