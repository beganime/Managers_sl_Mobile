# ManagerSL Mobile 2.4.0

## Что добавлено

- единый раздел сервисов Students Life: Task Manager SL, TranslateSL, DiskSL и ExamSL;
- нативный экран экзаменов с поиском клиента, созданием экзамена и проверкой просмотра уведомления;
- переход по нажатию на push-уведомление к уведомлению или задаче;
- регистрация push-токена после входа с системным запросом разрешения;
- официальная квадратная иконка для Android, iOS, splash screen и web;
- Firebase-файлы подключены к Expo-конфигурации.

## Firebase

- Android package: `com.studentslife.managersl`;
- iOS bundle id: `com.beganime.ManagersSL`;
- используются отдельные клиентские файлы ManagerSL (`google-services.json` и `GoogleService-Info.plist`);
- серверный service account остаётся только на ManagerSL backend и не попадает в мобильную сборку.

## Проверка перед сборкой

```powershell
npm install
npm run typecheck
npm run lint
npx expo-doctor
```

Ожидаемый результат: TypeScript и lint без ошибок, Expo Doctor — 18/18.

## Сборка

Локальный `eas-cli` удалён из зависимостей проекта. Для сборки используйте:

```powershell
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
```

Перед публикацией проверить вход, выдачу разрешения на уведомления, открытие всех четырёх сервисов и назначение тестового экзамена клиенту с мобильным аккаунтом.
