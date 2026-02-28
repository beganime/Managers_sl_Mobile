// src/api/apiClient.ts
import axios from 'axios';
import { deleteToken, getToken, saveToken } from '../utils/storage';

const BASE_URL = 'https://manager-sl.ru/api';

const apiClient = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.request.use(
    async (config) => {
        const token = await getToken('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const refreshToken = await getToken('refresh_token');
                if (refreshToken) {
                    const response = await axios.post(`${BASE_URL}/token/refresh/`, {
                        refresh: refreshToken
                    });
                    
                    const { access } = response.data;
                    await saveToken('access_token', access);
                    
                    originalRequest.headers.Authorization = `Bearer ${access}`;
                    return apiClient(originalRequest);
                }
            } catch (refreshError) {
                await deleteToken('access_token');
                await deleteToken('refresh_token');
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;