// src/utils/offlineSync.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/apiClient';

export async function fetchWithCache(endpoint: string, cacheKey: string) {
    try {
        // Пытаемся получить свежие данные с сервера
        const response = await apiClient.get(endpoint);
        const data = response.data.results || response.data; // Поддержка пагинации DRF
        
        // Сохраняем в кэш
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
        
        return { data, isOffline: false };
    } catch (error) {
        console.warn(`[Network Error] Не удалось загрузить ${endpoint}. Ищем в кэше...`);
        
        // Если ошибка сети, достаем из кэша
        const cachedData = await AsyncStorage.getItem(cacheKey);
        if (cachedData) {
            return { data: JSON.parse(cachedData), isOffline: true };
        }
        
        // Если и в кэше ничего нет, прокидываем ошибку дальше
        throw error;
    }
}