# Backend Specification

Документ описывает, какой backend нужен для прототипа `codenameVira`, чтобы поддержать текущие экраны кабинета методиста.

## 1. Цель backend

Backend должен обеспечивать:

- аутентификацию методиста;
- управление профилем музея;
- управление маршрутами;
- управление артефактами и их контентом;
- публикацию артефактов;
- аналитику по посетителям и dashboard-метрики;
- список обратной связи и активности.

Формат API: `REST + JSON`.

Локально проект поддерживает оба варианта путей:

- прямые service-paths: `/auth/*`, `/artifacts/*`;
- versioned proxy-paths: `/api/v1/auth/*`, `/api/v1/artifacts/*`.

Для frontend-интеграции предпочтительно использовать versioned-paths `/api/v1/...`.

## 2. Роли

- `methodist` — основной пользователь кабинета;
- `museum_admin` — расширенные права по настройкам и пользователям;
- `moderator` — опционально, если нужна модерация публикаций.

## 3. Основные сущности

### 3.1 User

```json
{
  "id": "usr_001",
  "email": "anna@museum.ru",
  "fullName": "Анна Смирнова",
  "role": "methodist",
  "museumId": "mus_001",
  "status": "active",
  "createdAt": "2026-06-15T08:00:00Z"
}
```

### 3.2 Museum

```json
{
  "id": "mus_001",
  "name": "Государственный исторический музей",
  "code": "GIM-1872",
  "shortDescription": "Крупнейший национальный исторический музей России",
  "website": "https://www.shm.ru",
  "foundedYear": 1872,
  "address": "г. Москва, Красная площадь, 1",
  "logoUrl": "https://cdn.example.com/museum/logo.png",
  "contacts": {
    "email": "info@shm.ru",
    "phone": "+7 (495) 692-01-51",
    "workingHours": "Ежедневно 10:00–21:00"
  }
}
```

### 3.3 Route

```json
{
  "id": "rte_001",
  "museumId": "mus_001",
  "title": "Письма с фронта",
  "description": "Истории солдат в письмах",
  "status": "published",
  "artifactsCount": 12,
  "views": 824,
  "updatedAt": "2026-06-15T08:00:00Z"
}
```

Статусы:

- `draft`
- `published`
- `archived`

### 3.4 Artifact

```json
{
  "id": "art_001",
  "museumId": "mus_001",
  "title": "Письмо фронтовика 1943 года",
  "shortDescription": "Фронтовые письма — особенные документы",
  "description": "Полное описание артефакта",
  "category": "letters",
  "createdDate": "1943-04-12",
  "period": "1941-1944",
  "originPlace": "Сталинград",
  "tags": ["письмо", "война", "фронт"],
  "coverUrl": "https://cdn.example.com/artifacts/art_001/cover.jpg",
  "status": "published",
  "visibility": "public",
  "downloadsAllowed": false,
  "viewsVisible": true,
  "publishedAt": "2026-06-15T08:00:00Z",
  "createdAt": "2026-06-15T07:00:00Z",
  "updatedAt": "2026-06-15T08:00:00Z"
}
```

Статусы:

- `draft`
- `moderation`
- `published`
- `archived`

### 3.5 ArtifactScreen

Нужна отдельная сущность для контентных экранов артефакта.

```json
{
  "id": "scr_001",
  "artifactId": "art_001",
  "type": "text-photo",
  "title": "Прохождение истории",
  "subtitle": "Текст + фото",
  "order": 2,
  "isSystem": false,
  "payload": {
    "text": "Фронтовые письма — это особенные документы...",
    "imageUrl": "https://cdn.example.com/artifacts/art_001/story-1.jpg"
  }
}
```

Типы экранов:

- `system-start`
- `text-photo`
- `quiz`
- `model-3d`
- `audio-photo`
- `system-finish`

### 3.6 VisitorAnalytics

```json
{
  "totalVisitors": 1248,
  "newVisitors": 342,
  "avgRouteDurationMinutes": 18,
  "artifactViews": 3826,
  "dynamics": [
    {"date": "2026-05-14", "visitors": 420, "newVisitors": 120}
  ],
  "sources": [
    {"source": "direct", "percent": 45, "count": 562},
    {"source": "qr", "percent": 30, "count": 374}
  ]
}
```

### 3.7 FeedbackItem

```json
{
  "id": "fb_001",
  "museumId": "mus_001",
  "type": "route_request",
  "title": "Новая заявка на маршрут",
  "subtitle": "Школа №124, 7 класс",
  "status": "new",
  "createdAt": "2026-06-15T08:00:00Z"
}
```

Типы:

- `route_request`
- `artifact_question`
- `improvement_suggestion`
- `review`

## 4. Аутентификация

## 4.1 Регистрация

`POST /api/v1/auth/register`

```json
{
  "email": "anna@museum.ru",
  "password": "StrongPassword123",
  "full_name": "Анна Смирнова"
}
```

Ответ:

```json
{
  "user": {
    "id": "usr_001",
    "email": "anna@museum.ru",
    "full_name": "Анна Смирнова",
    "created_at": "2026-06-15T08:00:00Z",
    "updated_at": "2026-06-15T08:00:00Z"
  }
}
```

## 4.2 Логин

`POST /api/v1/auth/login`

```json
{
  "email": "anna@museum.ru",
  "password": "StrongPassword123"
}
```

Ответ:

```json
{
  "access_token": "jwt_access_token",
  "refresh_token": "jwt_refresh_token",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

## 4.3 Refresh

`POST /api/v1/auth/refresh`

```json
{
  "refresh_token": "jwt_refresh_token"
}
```

## 4.4 Logout

`POST /api/v1/auth/logout`

```json
{
  "refresh_token": "jwt_refresh_token"
}
```

## 4.5 Текущий пользователь

`GET /api/v1/auth/me`

## 5. Dashboard

## 5.1 Метрики dashboard

`GET /api/v1/dashboard/summary`

Ответ:

```json
{
  "visitorsPerMonth": 1248,
  "avgRouteDurationMinutes": 18,
  "avgProgressPercent": 87,
  "museumRating": 4.8,
  "deltas": {
    "visitorsPerMonth": "+18%",
    "avgRouteDurationMinutes": "+2 мин",
    "avgProgressPercent": "+5%",
    "museumRating": "+0.3"
  }
}
```

## 5.2 График посещаемости

`GET /api/v1/dashboard/attendance?period=week|month|year`

## 5.3 Популярные маршруты

`GET /api/v1/dashboard/popular-routes`

## 5.4 Недавняя активность

`GET /api/v1/dashboard/recent-activity`

## 5.5 Обратная связь

`GET /api/v1/dashboard/feedback`

## 6. Профиль музея

## 6.1 Получить профиль

`GET /api/v1/museum/profile`

## 6.2 Обновить профиль

`PATCH /api/v1/museum/profile`

```json
{
  "name": "Государственный исторический музей",
  "shortDescription": "Краткое описание музея",
  "website": "https://www.shm.ru",
  "foundedYear": 1872,
  "address": "г. Москва, Красная площадь, 1"
}
```

Примечание:

- `code` приходит в `GET`, но не должен редактироваться в `PATCH`.

## 6.3 Загрузка логотипа

`POST /api/v1/museum/logo`

`multipart/form-data`

- `file`

## 7. Маршруты

## 7.1 Список маршрутов

`GET /api/v1/routes?status=all|published|draft|archived&page=1&limit=20`

## 7.2 Сводные метрики маршрутов

`GET /api/v1/routes/summary`

## 7.3 Недавняя активность маршрутов

`GET /api/v1/routes/recent-activity`

## 8. Артефакты

## 8.1 Список артефактов

`GET /api/v1/artifacts?status=all|published|draft|archived&sort=createdAt_desc&category=letters&page=1&limit=24`

## 8.2 Сводные метрики артефактов

`GET /api/v1/artifacts/summary`

## 8.3 Создать артефакт

`POST /api/v1/artifacts`

```json
{
  "title": "Письмо фронтовика 1943 года",
  "shortDescription": "Фронтовые письма — особенные документы",
  "description": "Полное описание артефакта",
  "category": "letters",
  "createdDate": "1943-04-12",
  "period": "1941-1944",
  "originPlace": "Сталинград",
  "tags": ["письмо", "война", "фронт"],
  "status": "draft"
}
```

Ответ:

```json
{
  "artifact": {
    "id": "art_001",
    "title": "Письмо фронтовика 1943 года",
    "description": "Полное описание артефакта",
    "category": "letters",
    "status": "draft",
    "created_at": "2026-06-15T07:00:00Z",
    "updated_at": "2026-06-15T07:00:00Z"
  }
}
```

## 8.4 Обновить артефакт

`PATCH /api/v1/artifacts/{artifactId}`

## 8.5 Загрузить обложку

`POST /api/v1/artifacts/{artifactId}/cover`

`multipart/form-data`

## 9. Контент артефакта

## 9.1 Получить экраны артефакта

`GET /api/v1/artifacts/{artifactId}/screens`

Важно:

- backend должен всегда возвращать стартовый системный экран первым;
- backend должен всегда возвращать финальный системный экран последним;
- пользовательские экраны вставляются между ними.

## 9.2 Создать экран

`POST /api/v1/artifacts/{artifactId}/screens`

```json
{
  "type": "text-photo",
  "order": 2,
  "title": "Прохождение истории",
  "subtitle": "Текст + фото",
  "payload": {
    "text": "Фронтовые письма — это особенные документы...",
    "imageUrl": "https://cdn.example.com/artifacts/art_001/story-1.jpg"
  }
}
```

Примечание:

- в текущей реализации `payload` передаётся как JSON-строка;
- frontend собирает её через `JSON.stringify(...)` перед отправкой.

## 9.3 Обновить экран

`PATCH /api/v1/artifacts/{artifactId}/screens/{screenId}`

## 9.4 Изменить порядок экранов

`PUT /api/v1/artifacts/{artifactId}/screens/reorder`

```json
{
  "items": [
    {"screenId": "system-start", "order": 1},
    {"screenId": "scr_001", "order": 2},
    {"screenId": "scr_002", "order": 3},
    {"screenId": "system-finish", "order": 4}
  ]
}
```

## 9.5 Удалить экран

`DELETE /api/v1/artifacts/{artifactId}/screens/{screenId}`

Ограничение:

- `system-start` и `system-finish` не удаляются.

## 10. Публикация артефакта

## 10.1 Получить настройки публикации

`GET /api/v1/artifacts/{artifactId}/publication`

## 10.2 Обновить настройки публикации

`PATCH /api/v1/artifacts/{artifactId}/publication`

```json
{
  "status": "published",
  "visibility": "public",
  "routeAccess": "selected",
  "showViews": true,
  "allowDownloads": false
}
```

## 10.3 Опубликовать артефакт

`POST /api/v1/artifacts/{artifactId}/publish`

Ответ:

```json
{
  "artifactId": "art_001",
  "publicUrl": "https://museum.vira.ai/a/7x9k3",
  "qrCodeUrl": "https://cdn.example.com/qr/art_001.png",
  "downloads": {
    "png": "https://cdn.example.com/export/art_001.png",
    "jpg": "https://cdn.example.com/export/art_001.jpg",
    "pdf": "https://cdn.example.com/export/art_001.pdf"
  }
}
```

## 11. Посетители

## 11.1 Сводные метрики

`GET /api/v1/visitors/summary?period=day|week|month|year`

## 11.2 Динамика

`GET /api/v1/visitors/dynamics?period=day|week|month|year&series=visitors|newVisitors`

## 11.3 Источники

`GET /api/v1/visitors/sources?period=day|week|month|year`

## 11.4 Таблица посетителей

`GET /api/v1/visitors/list?page=1&limit=10&routeId=rte_001&teamId=team_001&from=2026-05-14&to=2026-06-14`

Ответ:

```json
{
  "items": [
    {
      "id": "vst_001",
      "name": "Иван Петров",
      "firstVisitAt": "2026-06-14T12:45:00Z",
      "routeTitle": "Письма с фронта",
      "routeProgressMeta": "7 завершённых экранов",
      "routeDurationMinutes": 22,
      "artifactViews": 24
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1248
  }
}
```

## 11.5 Экспорт

`POST /api/v1/visitors/export`

```json
{
  "format": "xlsx",
  "filters": {
    "from": "2026-05-14",
    "to": "2026-06-14",
    "routeId": null,
    "teamId": null
  }
}
```

## 12. Файлы и media

Для backend нужен media storage:

- изображения музея;
- обложки артефактов;
- изображения экранов;
- аудиофайлы;
- 3D-модели;
- QR-коды;
- export-файлы.

Рекомендуется:

- `S3-compatible storage`;
- CDN для публичных ссылок;
- presigned upload URLs для больших файлов.

## 13. Технические требования

- JWT access + refresh tokens;
- RBAC по ролям;
- пагинация во всех списках;
- сортировки и фильтры в списках артефактов, маршрутов, посетителей;
- аудит изменений для `artifacts`, `routes`, `museum profile`;
- soft delete для пользовательских сущностей;
- UTC в backend, локализация даты на frontend.

## 14. Минимальная последовательность реализации backend

### Phase 1

- auth;
- museum profile;
- artifacts list;
- create/update artifact;
- artifact screens CRUD;
- publish artifact;
- dashboard summary.

### Phase 2

- routes list + summary + recent activity;
- visitors analytics + table + export;
- feedback list;
- file uploads.

### Phase 3

- moderation flow;
- user settings;
- advanced permissions;
- audit log UI.

## 15. Что обязательно учесть

- Текущий UI предполагает, что `Профиль музея` частично редактируем, а `museumCode` нет.
- Текущий UI предполагает 3 шага wizard артефакта: `Основная информация`, `Контент`, `Публикация`.
- Экран `Маршруты и точки` из сценария исключён и не должен появляться в backend-flow.
- Контент артефакта должен стартовать только с системного первого и последнего экрана.
- Все пользовательские экраны вставляются между системными.
