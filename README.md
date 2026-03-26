# ManagerSL Mobile

Мобильное приложение **Students Life / ManagerSL** на **Expo + Expo Router**.

## Что уже исправлено
- исправлен auth flow с поддержкой `auth/login` и fallback на старый `token/`
- исправлён refresh token flow
- переделана нижняя навигация
- добавлен премиальный светлый UI
- добавлен экран `admin-payments`
- добавлен безопасный кэш для клиентов, вузов и задач
- добавлена локальная очередь задач для оффлайн-режима
- исправлены битые asset paths в `app.json`

## Запуск

```bash
npm install
npx expo start
```

## EAS

```bash
eas login
eas build:configure
eas build --profile development --platform android
```

## Архитектура
- `app/` — роуты Expo Router
- `src/api/` — API и fallback-логика
- `src/context/` — тема приложения
- `src/utils/` — storage, cache, offline
- `components/` — UI-компоненты
