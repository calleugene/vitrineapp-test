# ViraLabs Methodist Scenario Prototype

Продуктовый бэклог: [PRODUCT_BACKLOG.md](PRODUCT_BACKLOG.md). Завершённая работа из других чатов: [PRODUCT_EXTERNAL_WORK.md](PRODUCT_EXTERNAL_WORK.md). Живой отчёт сайта доступен по `/methodist/updates.html`; `npm run report:product` обновляет `public/updates.html` и локальную копию [PRODUCT_REPORT.html](PRODUCT_REPORT.html). Caddy раздаёт `public/updates.html` напрямую, поэтому новая сводка появляется без пересборки панели. Открытая HTML-страница перечитывает файл раз в минуту.

Интерактивный прототип кабинета методиста, сверстанный на `React + Vite + Gravity UI` по макетам сценария работы с артефактами.

## Что внутри

- `Главная`
- `Маршруты`
- `Артефакты`
- создание и редактирование экспонатов через Artifacts API
- текстовые экраны с фоновым изображением, изменение порядка экранов
- публикация экспоната с постоянной ссылкой и QR-кодом

## Как запустить

```bash
cd Frontend/MetodistPanel
npm install
npm run dev
```

По умолчанию `Vite` поднимет локальный адрес вроде:

- `http://127.0.0.1:5173`

Для production-сборки:

```bash
npm run build
```

Production-сборка использует префикс `/methodist/`, соответствующий `deploy/windows/Caddyfile`.
Обычный `npm run build` и инженерный `npm run check` сохраняют этот префикс;
dev-сервер по-прежнему работает от `/`. В production адреса API по умолчанию
относительные (`/api/auth`, `/api/artifacts` и т. д.), как в Windows Caddy;
поэтому кабинет работает и через localhost, и по IP сервера в локальной сети.
В dev используются localhost и порты сервисов. Явные `VITE_*_API_URL` переопределяют
эти значения; не переносите localhost-адреса из `.env.example` в production-окружение.

QR-коды генерируются локально в браузере через `qrcode`, без отправки публичной ссылки внешнему сервису.

Для включения синхронизации маршрутов с RouteService задайте `VITE_ROUTE_API_ENABLED=true`
и `VITE_ROUTE_API_URL`/`VITE_MUSEUM_ID`. В этом режиме публикация и удаление выполняются через
`POST/PATCH/DELETE /api/v1/routes`; при выключенном флаге прототип сохраняет локальный draft.
Готовый шаблон переменных находится в `.env.example`.
Адреса сервисов, флаг синхронизации маршрутов, ID по умолчанию и ключи локального хранения собраны в `src/app/config.js`.
Профиль музея обслуживается Artifacts API, поэтому отдельный `VITE_MUSEUM_API_URL` не требуется.
Демонстрационные данные лежат рядом с соответствующими экранами в `src/features/*/demo-data.js`; общая навигация описана в `src/app/navigation.js`.

Для базовой инженерной проверки перед коммитом:

```bash
npm run check
```

`check` запускает ESLint, TypeScript и production-сборку. Пока `checkJs` выключен, TypeScript не проверяет исходные `.js` и `.jsx` файлы по типам.

## Стили

Глобальные стили разбиты на модули в `src/styles/`; точка входа — `src/styles.css` (barrel `@import`).

- Общие токены (`:root` CSS-переменные) — `src/styles/tokens.css`.
- Оболочка / auth / фичи кабинета — соответствующий файл в `src/styles/` (`shell.css`, `auth.css`, `routes.css`, …).
- Новый UI фичи — CSS рядом с компонентом (`src/features/.../*.css`) или в уже существующий модуль `src/styles/`. Не наращивать монолит в `styles.css`.
- Стили редактора экспонатов — `src/features/artifacts/server-artifact-flow.css`.

## Как тестировать

1. Откройте `Артефакты`.
2. Нажмите `Добавить артефакт`.
3. Заполните основные сведения об экспонате и при необходимости загрузите обложку.
4. На шаге `Контент` добавьте текстовый экран, отредактируйте его и при необходимости загрузите изображение.
5. Опубликуйте экспонат и проверьте постоянную ссылку и QR-код.
