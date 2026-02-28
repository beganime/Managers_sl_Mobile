// src/utils/storage.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export async function saveToken(key: string, value: string) {
    if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
    } else {
        await SecureStore.setItemAsync(key, value);
    }
}

export async function getToken(key: string) {
    if (Platform.OS === 'web') {
        return localStorage.getItem(key);
    } else {
        return await SecureStore.getItemAsync(key);
    }
}

export async function deleteToken(key: string) {
    if (Platform.OS === 'web') {
        localStorage.removeItem(key);
    } else {
        await SecureStore.deleteItemAsync(key);
    }
}