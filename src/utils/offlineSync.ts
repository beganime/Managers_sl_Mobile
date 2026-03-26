import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { extractResults } from '../api/apiClient';

export async function fetchWithCache(endpoint: string, cacheKey: string, params?: Record<string, any>) {
  try {
    const response = await apiClient.get(endpoint, { params });
    const data = extractResults(response.data);
    await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    return { data, isOffline: false };
  } catch (error) {
    const cachedData = await AsyncStorage.getItem(cacheKey);
    if (cachedData) {
      return { data: JSON.parse(cachedData), isOffline: true };
    }
    throw error;
  }
}

export async function saveCache<T>(cacheKey: string, data: T) {
  await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
}

export async function readCache<T>(cacheKey: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(cacheKey);
  return raw ? JSON.parse(raw) as T : fallback;
}
