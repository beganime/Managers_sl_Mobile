// src/utils/storage.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export async function saveToken(key: string, value: string) {
    try {
        if (Platform.OS === 'web') {
            localStorage.setItem(key, value);
        } else {
            await SecureStore.setItemAsync(key, value);
        }
    } catch (error) {
        console.error(`Error saving token ${key}:`, error);
    }
}

export async function getToken(key: string) {
    try {
        if (Platform.OS === 'web') {
            return localStorage.getItem(key);
        } else {
            return await SecureStore.getItemAsync(key);
        }
    } catch (error) {
        console.error(`Error getting token ${key}:`, error);
        return null;
    }
}

export async function deleteToken(key: string) {
    try {
        if (Platform.OS === 'web') {
            localStorage.removeItem(key);
        } else {
            await SecureStore.deleteItemAsync(key);
        }
    } catch (error) {
        console.error(`Error deleting token ${key}:`, error);
    }
}