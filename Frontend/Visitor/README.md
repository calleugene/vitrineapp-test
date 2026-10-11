# ViraLabs Mobile Story Prototype

Static mobile prototype prepared for a backend integration step.

## What changed

The prototype is no longer a single inline-script page. The UI now works through four layers:

- `index.html` - view shell and bindings
- `app/mock-data.js` - seed data for museums, artifacts, and stories
- `app/api-client.js` - switchable `mock` / `real` API layer
- `app/store.js` - tiny client state store
- `app/main.js` - rendering, navigation, QR flow, and UI actions

This means the frontend already talks to an API-shaped interface, even while running in mock mode.

## Current mode

By default the app starts with:

```html
<script>
  window.__VIRALABS_CONFIG__ = {
    apiMode: "auto",
    apiBaseUrl: "http://127.0.0.1:8080/api/v1"
  };
</script>
```

`auto` means:

- if the prototype is served over `http/https` and local Go backend is available on `http://127.0.0.1:8080/api/v1`, it uses real visitor APIs
- if the prototype is opened directly via `file://`, it stays on mock data to avoid noisy failed network requests
- if backend is unavailable, the prototype falls back to mock data so the UI still opens

To force only real backend mode, switch `apiMode` to `"real"`.

Для отправки аналитических событий можно указать `analyticsEventsUrl` в `window.__VIRALABS_CONFIG__`.
События (`scan`, `scene_view`, `quiz_answer`, `scene_complete`) сохраняются в локальной очереди и
отправляются после восстановления сети. При пустом URL приложение работает без сетевой отправки,
но очередь сохраняется для подключения endpoint позже.

Production-сборка также регистрирует `public/sw.js` и использует `manifest.webmanifest`.
Статическая оболочка кешируется, а same-origin API запрашивается через network-first с fallback
в кеш при потере сети.

## Backend contract

### 1. Bootstrap

`GET /api/bootstrap`

Expected response shape:

```json
{
  "museums": [
    {
      "id": "history-city",
      "title": "Музей истории города",
      "subtitle": "Соберите 5 артефактов и откройте мини-истории экспонатов.",
      "durationLabel": "примерно 10 минут",
      "heroCaption": "Нейтральная иллюстрация фасада музея",
      "artifacts": [
        {
          "id": "front-letter",
          "title": "Письмо фронтовика 1943 года",
          "summary": "История письма, дошедшего через годы",
          "found": false,
          "thumbVariant": "triangle",
          "foundDescription": "Вы нашли письмо фронтовика 1943 года.",
          "receivedDescription": "Письмо фронтовика добавлено в вашу коллекцию.",
          "story": {
            "topTitle": "Письмо фронтовика<br>1943 года",
            "coverTitle": "Письмо,<br>которое дошло через годы",
            "coverSubtitle": "История одного фронтового письма 1943 года",
            "factOneTitle": "Это письмо написано <span class=\"accent\">в 1943 году</span>",
            "factOneText": "Его написал солдат своей семье с фронта.",
            "factTwoTitle": "Письма часто складывали треугольником",
            "factTwoText": "Потому что не хватало конвертов.",
            "factTwoNote": "Обычные конверты на фронте были в дефиците.",
            "arTitle": "Наведите камеру на экспонат",
            "arText": "Чтобы увидеть 3D-модель письма в дополненной реальности.",
            "quizQuestion": "Фронтовые письма всегда отправлялись в конвертах.",
            "explainTitle": "Многие письма складывали треугольником — конвертов часто не хватало.",
            "finalTitle": "Спасибо, что прошли историю!",
            "finalText": "Теперь это не просто письмо. Это голос человека из прошлого."
          }
        }
      ]
    }
  ]
}
```

### 2. QR scan resolve

`POST /api/museums/:museumId/scan`

Request:

```json
{
  "qrValue": "front-letter"
}
```

Response:

```json
{
  "museum": { "...": "updated museum payload" },
  "artifact": { "...": "resolved artifact payload" }
}
```

### 3. Collect artifact

`POST /api/museums/:museumId/artifacts/:artifactId/collect`

Response:

```json
{
  "museum": { "...": "updated museum payload" },
  "artifact": { "...": "updated artifact payload" }
}
```

## Why this is backend-ready now

- museums list is rendered from data, not hardcoded cards
- museum detail and artifact states are rendered from state
- story copy can be supplied per artifact from API payload
- QR flow resolves through an API abstraction
- collecting an artifact goes through an API abstraction

## Local use

Open `/Users/eugeneanufrienko/Desktop/codex/Предприниматель/ViraLabs/mobile-story-prototype/index.html` in a browser, or use the deployed version on Vercel.

For real backend integration, start:

- Go API from `/Users/eugeneanufrienko/Desktop/codex/Предприниматель/ViraLabs/apps/api-go`
- PostgreSQL required by `DATABASE_URL`

The frontend now uses these real endpoints:

- `POST /api/v1/visitors/guest`
- `GET /api/v1/museums`
- `GET /api/v1/museums/:museumId`
- `POST /api/v1/routes/:routeId/scan`
- `GET /api/v1/routes/:routeId/story`
- `GET /api/v1/visitors/:visitorId/profile`
- `GET /api/v1/visitors/:visitorId/collection`
- `GET /api/v1/visitors/:visitorId/artifacts/:artifactId`
- `PUT /api/v1/visitors/:visitorId/artifacts/:artifactId/favorite`
- `GET /api/v1/visitors/:visitorId/route-results/:routeId`
- `GET /api/v1/visitors/:visitorId/achievements`
- `GET /api/v1/visitors/:visitorId/settings`
