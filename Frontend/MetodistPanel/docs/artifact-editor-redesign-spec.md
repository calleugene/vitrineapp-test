# Техническая спецификация: обновление редактора артефактов

**Статус:** Draft  
**Компоненты:** `Frontend/MetodistPanel`, `Backend/artifacts-service`, visitor preview  
**Стек:** React 19, Vite 8, Gravity UI, Go, OpenAPI 3.1  
**Макеты:** редактор «Текст + фото», сборка контента артефакта, редактор «3D-модель»  

## 1. Цель

Обновить сценарий создания артефакта и редактирования его экранов, сохранив существующую трёхшаговую модель:

1. Основная информация.
2. Контент.
3. Публикация.

Результат должен обеспечивать:

- компактную сборку и сортировку экранов;
- единый редактор для типов `text_photo`, `text`, `photo`, `model_3d`;
- синхронный предпросмотр посетительского экрана;
- загрузку и обработку изображений и GLB/GLTF-моделей;
- автосохранение с обработкой конфликтов и ошибок;
- доступность с клавиатуры и соответствие WCAG 2.1 AA.

## 2. Границы задачи

### 2.1. В scope

- новая компоновка редактора и шага «Контент»;
- дизайн-токены и переиспользуемые компоненты редактора;
- CRUD экранов;
- drag-and-drop и клавиатурная сортировка;
- загрузка изображений и 3D-моделей;
- интерактивный WebGL-предпросмотр 3D-модели;
- автосохранение черновика;
- клиентская и серверная валидация;
- состояния loading, empty, success, error и conflict;
- адаптивная компоновка от 768 px;
- unit, integration и E2E-тесты;
- актуализация OpenAPI.

### 2.2. Не входит в scope

- редактирование геометрии, материалов и анимаций 3D-модели;
- конвертация CAD/FBX/OBJ на клиенте;
- изменение visitor-приложения за пределами компонентов предпросмотра;
- редизайн остальных разделов кабинета;
- совместное редактирование несколькими пользователями в реальном времени.

## 3. Текущее состояние и целевые изменения

| Область | Сейчас | Требуется |
|---|---|---|
| Черновик | хранение в `localStorage` | серверный draft как источник истины, локальный fallback |
| Список экранов | карточки в горизонтальной сетке | компактный вертикальный сортируемый список |
| Предпросмотр | декоративный thumbnail | общий renderer, максимально близкий к visitor UI |
| 3D | визуальная заглушка | настоящий viewer GLB/GLTF |
| Payload | строка без строгой схемы | версионированный JSON payload по типу экрана |
| Reorder | endpoint уже существует | optimistic update, rollback и keyboard DnD |
| Тесты панели | тестовый runner отсутствует | Vitest, Testing Library, MSW, Playwright |

## 4. Архитектура frontend

### 4.1. Предлагаемая структура

```text
Frontend/MetodistPanel/src/features/artifacts/
├── components/
│   ├── ArtifactWizardStepper.jsx
│   ├── ArtifactContentList.jsx
│   ├── ArtifactScreenRow.jsx
│   ├── ArtifactScreenEditor.jsx
│   ├── ArtifactPreview.jsx
│   ├── ScreenSettingsPanel.jsx
│   ├── AutosaveIndicator.jsx
│   ├── MediaFileCard.jsx
│   └── ModelFileCard.jsx
├── editors/
│   ├── TextPhotoEditor.jsx
│   └── Model3DEditor.jsx
├── preview/
│   ├── ScreenPreviewRenderer.jsx
│   ├── TextPhotoPreview.jsx
│   └── Model3DPreview.jsx
├── hooks/
│   ├── useArtifactAutosave.js
│   ├── useScreenEditor.js
│   ├── useScreenReorder.js
│   └── useModelProcessing.js
├── model/
│   ├── screenPayload.js
│   ├── screenValidation.js
│   └── screenMappers.js
└── views.jsx
```

Разделение допускается внедрять постепенно. `views.jsx` не должен содержать бизнес-правила валидации, сериализации payload или reorder.

### 4.2. Управление состоянием

- Серверный draft является источником истины после получения `draftId`.
- Локальное состояние формы хранит несохранённые изменения.
- `localStorage` используется только для восстановления при недоступном API и очищается после успешной публикации/удаления draft.
- Сохранение запускается через debounce `800 ms` после последнего изменения.
- Одновременно разрешён только один save-request. Изменения во время запроса формируют следующий save.
- Каждый PATCH draft передаёт `version`; сервер возвращает новую версию.
- Ответ `409 Conflict` переводит UI в состояние `conflict` и блокирует автоматическую перезапись.

### 4.3. Состояния автосохранения

```ts
type AutosaveState =
  | 'idle'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'offline'
  | 'error'
  | 'conflict';
```

Отображение:

- `saving` — «Сохранение…»;
- `saved` — «Все изменения сохранены» и время;
- `offline` — «Нет сети. Изменения сохранены локально»;
- `error` — «Не удалось сохранить» + «Повторить»;
- `conflict` — диалог выбора «Загрузить серверную версию» / «Сохранить копию».

## 5. Модель данных экранов

### 5.1. Общая модель

```ts
type ScreenType = 'text_photo' | 'text' | 'photo' | 'model_3d';

interface ArtifactScreen {
  id: string;
  artifactId: string;
  type: ScreenType;
  title: string;
  position: number;
  required: boolean;
  showNextButton: boolean;
  narrationEnabled: boolean;
  coverMediaId: string | null;
  payloadVersion: 1;
  payload: TextPhotoPayload | Model3DPayload;
  status: 'draft' | 'ready' | 'error';
  createdAt: string;
  updatedAt: string;
}
```

### 5.2. Payload «Текст + фото»

```ts
interface TextPhotoPayload {
  body: string;
  mediaId: string | null;
  mediaAlt: string;
  layout: 'image_after_text';
}
```

Правила:

- `title`: 1–120 символов;
- `body`: 1–1000 символов для `text_photo` и `text`;
- `mediaId`: обязателен для `text_photo` и `photo`;
- `mediaAlt`: 1–160 символов при наличии изображения.

### 5.3. Payload «3D-модель»

```ts
interface Model3DPayload {
  description: string;
  modelId: string | null;
  rotationEnabled: boolean;
  zoomEnabled: boolean;
  autoRotate: boolean;
  hintsEnabled: boolean;
  camera: {
    minDistance: number;
    maxDistance: number;
    initialPosition?: [number, number, number];
  };
  background: 'charcoal' | 'light';
}
```

Правила:

- `title`: 1–120 символов;
- `description`: 0–1000 символов;
- `modelId`: обязателен;
- модель должна иметь `processingStatus = ready`;
- `minDistance > 0` и `maxDistance > minDistance`;
- `autoRotate = true` допустимо только при `rotationEnabled = true`.

## 6. Изменения API

Базовые endpoints уже определены в `Backend/artifacts-service/openapi.yaml`. Необходимо типизировать payload и расширить контракты.

### 6.1. Screens

```http
GET    /api/v1/artifacts/{artifactId}/screens
POST   /api/v1/artifacts/{artifactId}/screens
GET    /api/v1/artifacts/{artifactId}/screens/{screenId}
PATCH  /api/v1/artifacts/{artifactId}/screens/{screenId}
DELETE /api/v1/artifacts/{artifactId}/screens/{screenId}
PUT    /api/v1/artifacts/{artifactId}/screens/reorder
```

Изменить schemas:

- `payload` — JSON object вместо string;
- добавить `payload_version`, `required`, `show_next_button`, `narration_enabled`, `cover_media_id`, `status`;
- `type` ограничить enum;
- PATCH должен поддерживать частичное обновление и возвращать актуальный `updated_at`.

### 6.2. Reorder

Request:

```json
{
  "screen_ids": ["screen-2", "screen-1"],
  "version": 7
}
```

Требования backend:

- список содержит все неудалённые экраны артефакта ровно один раз;
- чужие и неизвестные IDs отклоняются;
- обновление позиций выполняется транзакционно;
- несовпадение `version` возвращает `409`;
- response содержит экраны с нормализованными `position` и новую `version`.

### 6.3. Media

Разрешённые изображения:

- MIME: `image/jpeg`, `image/png`, `image/webp`;
- максимальный размер: 10 МБ;
- минимальное разрешение обложки: 800×600;
- содержимое проверяется по magic bytes, а не только по MIME/расширению.

Upload flow:

1. Клиент валидирует файл.
2. Файл загружается в storage через существующий media flow.
3. Backend создаёт `Media`.
4. `mediaId` записывается в screen payload.

### 6.4. Models

Использовать endpoints:

```http
POST /api/v1/models/upload
POST /api/v1/models/{modelId}/process
GET  /api/v1/models/{modelId}/status
GET  /api/v1/models/{modelId}
```

Расширить `Model`:

```yaml
size_bytes: integer
processing_status: [uploaded, processing, ready, failed]
processing_error: string | null
preview_url: string | null
bounds: object | null
```

Ограничения:

- форматы: `.glb`, `.gltf`;
- максимальный размер: 50 МБ;
- проверять magic bytes/структуру файла;
- внешние URI внутри GLTF запрещены либо должны проходить allowlist и копироваться в управляемое storage;
- текстуры и суммарный объём распакованных ресурсов ограничиваются сервером;
- polling статуса: каждые 2 секунды, максимум 2 минуты, затем ручной retry;
- сохранение `model_3d` недоступно до статуса `ready`.

## 7. UI и поведение

### 7.1. Общие требования

- desktop ≥ 1440 px: три колонки;
- 1024–1439 px: настройки открываются в side sheet;
- 768–1023 px: форма, preview и настройки располагаются последовательно;
- ниже 768 px: текущий релиз допускает read-only notice, если полноценный editor не поддерживается;
- нижняя action bar остаётся видимой и не перекрывает поля;
- минимальная интерактивная область — 44×44 px;
- все поля имеют label, error и help text;
- все действия доступны с клавиатуры.

### 7.2. Шаг «Контент»

Каждая строка экрана показывает:

- drag handle;
- позицию;
- тип;
- заголовок;
- статус;
- preview thumbnail;
- краткий текст;
- «Редактировать»;
- overflow menu: дублировать, переместить вверх/вниз, удалить.

DnD:

- optimistic UI;
- placeholder места вставки;
- `aria-live` сообщение после перемещения;
- клавиши `Space` — взять/положить, `ArrowUp/ArrowDown` — переместить, `Escape` — отменить;
- при ошибке API выполняется rollback и показывается toast.

Удаление требует подтверждения. После удаления выбирается ближайший экран. Удаление последнего экрана переводит страницу в empty state.

### 7.3. Редактор экрана

- левая колонка — форма;
- центральная — preview в рамке устройства;
- правая — порядок, обложка, статус и контекстная справка;
- preview обновляется локально без ожидания автосохранения;
- переключение типа экрана требует подтверждения, если приводит к потере несовместимого payload;
- основное действие недоступно при ошибках формы или незавершённой загрузке.

### 7.4. 3D viewer

Рекомендуемая реализация: `three`, `@react-three/fiber`, `@react-three/drei`.

Функции:

- `GLTFLoader` для GLB/GLTF;
- `OrbitControls` с параметрами из payload;
- автоматическое вычисление bounds и fit-to-view;
- reset camera;
- полноэкранный режим;
- progress indicator;
- fallback при отсутствии WebGL;
- освобождение geometry, material, texture и object URL при unmount/замене модели;
- lazy loading viewer chunk только для `model_3d`;
- прекращение render loop при невидимой вкладке и при уходе viewer за viewport;
- поддержка `prefers-reduced-motion`: auto-rotate принудительно выключается.

Целевые ограничения:

- UI не блокируется более чем на 100 ms при открытии editor;
- viewer chunk не входит в initial bundle остальных экранов;
- first interactive preview для подготовленной модели — ≤ 3 s на типичном broadband;
- canvas восстанавливается после `webglcontextlost`, иначе показывает fallback.

## 8. Доступность

- WCAG 2.1 AA для контраста текста и controls;
- видимый focus ring;
- корректный tab order: header → form → preview controls → settings → action bar;
- status и autosave объявляются через `aria-live="polite"`;
- ошибки формы связываются с полями через `aria-describedby`;
- icon-only buttons имеют `aria-label`;
- DnD имеет клавиатурную альтернативу;
- preview canvas имеет текстовое описание и fallback-изображение;
- жесты вращения/масштабирования дублируются кнопками управления.

## 9. Безопасность

- backend проверяет принадлежность artifact, screen, media и model текущему museum/user;
- filename не используется как storage path;
- HTML из title/body не рендерится через `dangerouslySetInnerHTML`;
- upload URL имеет ограниченный TTL;
- CSP разрешает модели и текстуры только из доверенного storage;
- GLTF не должен инициировать произвольные cross-origin запросы;
- ошибки API не раскрывают внутренние storage paths и stack traces;
- удаление media/model проверяет ссылки из опубликованных экранов.

## 10. Наблюдаемость и аналитика

События продукта:

- `artifact_screen_created`;
- `artifact_screen_updated`;
- `artifact_screen_reordered`;
- `artifact_screen_deleted`;
- `artifact_preview_opened`;
- `artifact_model_upload_started`;
- `artifact_model_processing_completed`;
- `artifact_model_processing_failed`;
- `artifact_draft_autosave_failed`.

В события не передавать title/body и исходные имена файлов. Допустимы IDs, тип экрана, размер файла, длительность и код ошибки.

Backend metrics:

- latency/error rate CRUD screens;
- latency/error rate reorder;
- длительность и доля ошибок model processing;
- количество `409` draft conflicts;
- размер загружаемых media/models.

## 11. Миграция и обратная совместимость

1. Добавить `payload_version` со значением `1`.
2. Существующий string payload читать через legacy parser.
3. При первом успешном PATCH сохранять payload в новой JSON-схеме.
4. Старые screen types сопоставить с новым enum через mapper.
5. Миграция должна быть идемпотентной.
6. До завершения rollout backend принимает старый и новый payload, но возвращает нормализованную модель.
7. Включать новый UI feature flag `artifact_editor_v2`.

## 12. Unit tests

### 12.1. Инфраструктура frontend

Добавить:

- `vitest`;
- `@testing-library/react`;
- `@testing-library/user-event`;
- `@testing-library/jest-dom`;
- `jsdom`;
- `msw`;
- `axe-core` или `vitest-axe`;
- `playwright` для E2E.

Scripts:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test"
}
```

### 12.2. Frontend unit tests

#### `screenValidation`

- принимает корректный `text_photo`;
- отклоняет пустой title;
- отклоняет title длиннее 120 символов;
- отклоняет body длиннее 1000 символов;
- требует media для `text_photo` и `photo`;
- требует alt text при наличии изображения;
- требует готовую модель для `model_3d`;
- отклоняет `autoRotate=true` при `rotationEnabled=false`;
- проверяет границы camera distance;
- возвращает ошибки, привязанные к конкретным полям.

#### `screenMappers`

- преобразует API snake_case в UI camelCase;
- сериализует payload без потери boolean/nullable полей;
- мигрирует legacy string payload;
- неизвестный type переводит в безопасное unsupported state;
- сохраняет `payloadVersion`.

#### `useArtifactAutosave`

- не вызывает API до истечения debounce;
- объединяет несколько последовательных изменений;
- не запускает параллельные PATCH;
- выполняет следующий save, если данные изменились во время запроса;
- переходит `saving → saved`;
- переходит в `offline` при отсутствии сети;
- поддерживает ручной retry;
- обрабатывает `409` как conflict и не перезаписывает серверную версию;
- отменяет timer/request при unmount.

#### `useScreenReorder`

- корректно перемещает первый, средний и последний элементы;
- не меняет список для одинаковых IDs;
- выполняет optimistic update;
- делает rollback при ошибке API;
- игнорирует неизвестный ID;
- нормализует positions после успешного ответа.

#### Upload validators

- принимает JPG/PNG/WebP до 10 МБ;
- отклоняет неверный MIME/extension;
- отклоняет изображение меньше 800×600 для cover;
- принимает GLB/GLTF до 50 МБ;
- отклоняет превышение размера;
- корректно форматирует размер файла;
- revoke object URL выполняется при замене и unmount.

### 12.3. Component tests

#### `ArtifactScreenRow`

- отображает type, position, status и title;
- вызывает edit/duplicate/delete handlers;
- overflow menu доступно с клавиатуры;
- disabled edit имеет пояснение;
- DnD keyboard flow объявляется через `aria-live`.

#### `TextPhotoEditor`

- переключает варианты типа;
- показывает обязательные поля по типу;
- обновляет счётчики символов;
- блокирует сохранение при ошибках;
- изменения немедленно попадают в preview;
- удаление изображения возвращает upload empty state.

#### `Model3DEditor`

- показывает processing status;
- блокирует сохранение до `ready`;
- polling завершается при `ready` и `failed`;
- изменение switches обновляет preview props;
- auto-rotate выключается при отключении rotation;
- fallback показывается при отсутствии WebGL.

#### `AutosaveIndicator`

- отображает каждый AutosaveState;
- retry доступен только в error/offline;
- время последнего сохранения форматируется в timezone пользователя;
- статус объявляется screen reader.

### 12.4. Backend unit tests

- create/update screen валидирует type-specific payload;
- title/body limits проверяются сервером;
- чужой artifact/screen возвращает `404` или `403` согласно принятой политике;
- reorder выполняется атомарно;
- reorder отклоняет дубли, пропуски и чужие IDs;
- version mismatch возвращает `409`;
- media validator проверяет magic bytes, MIME, размер и разрешение;
- model validator проверяет формат и размер;
- model state machine запрещает недопустимые переходы;
- ready model разрешает сохранение screen, processing/failed — запрещает;
- legacy payload корректно мигрируется;
- повторная миграция не меняет данные.

## 13. Integration tests

- загрузка artifact draft → изменение поля → autosave → reload → данные восстановлены;
- добавление `text_photo` → upload media → save screen → preview получает media URL;
- reorder двух экранов → API success → порядок сохраняется после reload;
- reorder → API failure → UI выполняет rollback и показывает toast;
- upload model → processing → ready → сохранение `model_3d` становится доступно;
- processing failed → показываются причина и retry;
- conflict двух версий draft → UI показывает conflict dialog;
- удаление выбранного экрана выбирает соседний;
- публикация блокируется при экране со статусом error.

## 14. E2E tests

Playwright-сценарии:

1. Создание артефакта с одним экраном «Текст + фото» и переход к публикации.
2. Создание двух экранов, reorder мышью и проверка порядка после reload.
3. Reorder только клавиатурой.
4. Загрузка валидного изображения и отображение в preview.
5. Ошибка загрузки слишком большого изображения.
6. Загрузка GLB, ожидание processing status `ready`, вращение/zoom/reset viewer.
7. Fallback viewer при WebGL error.
8. Offline edit, восстановление сети и успешная синхронизация.
9. Предупреждение при уходе с несохранёнными изменениями.
10. Основной сценарий при viewport 1440×900, 1024×768 и 768×1024.

## 15. Definition of Done

### Функциональность

- [ ] Шаг «Контент» реализован как компактный вертикальный список.
- [ ] Создание, редактирование, дублирование и удаление экранов работают через API.
- [ ] Drag-and-drop и клавиатурная сортировка сохраняют порядок на сервере.
- [ ] Редакторы `text_photo`, `text`, `photo` и `model_3d` используют общую оболочку.
- [ ] Preview обновляется без сохранения и использует общий renderer с visitor UI.
- [ ] Изображения и модели имеют полный набор upload/error/retry states.
- [ ] 3D viewer поддерживает rotate, zoom, reset и fullscreen.
- [ ] Автосохранение поддерживает saved/error/offline/conflict states.
- [ ] Публикация блокируется при невалидных экранах.

### Backend и данные

- [ ] OpenAPI обновлён и проходит lint/validation.
- [ ] Payload типизирован, версионирован и валидируется сервером.
- [ ] Reorder транзакционный и защищён version check.
- [ ] Media/model ownership и upload validation реализованы.
- [ ] Legacy payload мигрируется без потери данных.
- [ ] Feature flag позволяет отключить новый редактор без rollback БД.

### Качество

- [ ] Все новые unit и integration tests проходят локально и в CI.
- [ ] Покрытие новых domain utilities/hooks — не менее 90% branches.
- [ ] Покрытие новых UI components — не менее 80% branches.
- [ ] Backend domain/service code задачи — не менее 85% coverage.
- [ ] Критические E2E-сценарии проходят в Chromium.
- [ ] Нет ошибок ESLint, TypeScript check, Go test и build.
- [ ] Нет новых critical/high замечаний dependency/security scan.

### UX и доступность

- [ ] Реализация визуально сверена с утверждёнными макетами на 1440 px.
- [ ] Интерфейс проверен на 1024 и 768 px.
- [ ] Все функции доступны с клавиатуры.
- [ ] Axe не выявляет critical/serious нарушений.
- [ ] Контраст соответствует WCAG 2.1 AA.
- [ ] Focus, loading, empty, disabled и error states реализованы.
- [ ] `prefers-reduced-motion` учитывается.

### Производительность и эксплуатация

- [ ] 3D viewer загружается отдельным lazy chunk.
- [ ] WebGL-ресурсы освобождаются при unmount.
- [ ] Добавлены продуктовые события и backend metrics без PII/content.
- [ ] Ошибки autosave, upload и model processing доступны в логах и мониторинге.
- [ ] Обновлены README/runbook для локального запуска тестов и 3D processing.
- [ ] QA завершил smoke/regression, Product и Design приняли результат.

## 16. Команды проверки

Целевой набор команд после подключения тестовой инфраструктуры:

```bash
cd Frontend/MetodistPanel
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run test:e2e

cd ../../Backend/artifacts-service
go test ./... -race -coverprofile=coverage.out
```

## 17. Рекомендуемая декомпозиция

1. Дизайн-токены, layout и общая оболочка редактора.
2. Типизированная screen model, mapper и validation.
3. Расширение OpenAPI и backend CRUD/reorder.
4. Вертикальный список экранов и доступный DnD.
5. Редактор и preview «Текст + фото».
6. Media upload flow.
7. Model upload/processing API.
8. 3D viewer и редактор `model_3d`.
9. Серверное автосохранение, offline fallback и conflicts.
10. Accessibility, analytics, responsive и performance pass.
11. Unit/integration/E2E, миграция и feature-flag rollout.

