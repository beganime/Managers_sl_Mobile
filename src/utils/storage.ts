import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

async function setString(key: string, value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getString(key: string) {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function removeString(key: string) {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function saveToken(key: string, value: string) {
  try {
    await setString(key, value);
  } catch (error) {
    console.error(`Error saving token ${key}:`, error);
  }
}

export async function getToken(key: string) {
  try {
    return await getString(key);
  } catch (error) {
    console.error(`Error getting token ${key}:`, error);
    return null;
  }
}

export async function deleteToken(key: string) {
  try {
    await removeString(key);
  } catch (error) {
    console.error(`Error deleting token ${key}:`, error);
  }
}

export async function saveJSON<T>(key: string, value: T) {
  await saveToken(key, JSON.stringify(value));
}

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await getToken(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export async function clearSession() {
  await deleteToken('access_token');
  await deleteToken('refresh_token');
  await deleteToken('cache_my_profile');
}
