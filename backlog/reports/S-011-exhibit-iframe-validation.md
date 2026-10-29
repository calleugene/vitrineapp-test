# S-011 — проверка встраивания экспоната

Дата: 29 октября 2026. **VERDICT: локальные функциональные проверки PASS; production readiness ограничена пунктами ниже.**

## Изменения и инварианты

Go artifacts-service: новая таблица `artifact_embed_opens(artifact_id, day, opens)` с атомарным upsert. Миграция `0007_embed_opens.postgres.sql`; SQLite test fixture соответствует новой таблице. Нет visitor/session ID, IP, UA, referrer, URL площадки или individual events в этой таблице. Чтение total защищено существующей signed tenancy middleware.

- `POST /api/v1/public/artifacts/{publicCode}/embed-opens`: только пустое тело; 204 при успехе/выключенном сборе, 400 при дополнительных данных, 404 для недоступного объекта при включённом сборе. Дата агрегата — серверный UTC-день. Счётчик не отражает уникальных людей; повторные загрузки могут учитываться.
- `GET /api/v1/artifacts/{artifactId}/embed-opens`: authenticated, только свой музей; `{enabled, opens}`. Нет отдельного dashboard; total показан в блоке embed.
- Public resolve: `no-store` для успеха и ошибки; последний опубликованный snapshot, не draft.
- `ARTIFACTS_EMBED_COUNTING_ENABLED=true` включает агрегирование. По умолчанию false. Сам просмотр не зависит от счётчика.

Frontend: отдельный `embed.html`/`embed-main.jsx`; импорт обычного App/его analytics bootstrap отсутствует. Общие нормализация, текст, quiz и 3D-компонент переиспользуются; AR отключён в iframe. Изолированный entry не обращается к storage, не вызывает collection/feedback/route APIs. Начальный успешный показ считает один экземпляр iframe один раз в памяти; preview и самостоятельное открытие embed-документа не учитываются.

## Выполненные проверки

| Проверка | Факт |
| --- | --- |
| Go `go test -race ./...`, `go vet ./...` | PASS, включая новые lifecycle/aggregate/privacy-input/signed-tenancy tests и существующие regressions |
| Кабинет `npm run check`, `npm test` | lint/typecheck/build PASS, 31 test PASS |
| Visitor `npm run check` | lint/typecheck/smoke/build PASS |
| Нормализация публичных экранов | существующий Node test PASS: порядок quiz/3D/legacy content |
| Production asset base | Visitor build с `--base=/visitor/` PASS; embed.html входит в сборку |
| Внешняя HTML-страница в Chrome | PASS: iframe с другого origin, text/quiz/completion, error/retry/unavailable, StrictMode one-count, preview excluded, заблокированные local/sessionStorage, нет behavioural requests/page errors |
| Контейнеры | 320/375/768/1024 CSS px: нет горизонтального переполнения; длинный текст прокручивается отдельно, навигация и подпись видимы |
| Кабинет в Chrome | PASS: генерация HTML, высота 800, clipboard rejection/manual fallback, published→draft без оставшегося iframe, stats, ширины 320/768/1024 |
| WordPress | PASS: локальный WordPress Playground CLI 3.1.61, WordPress 7.1.4, стандартная тема Twenty Twenty-Five; опубликованная страница с Custom HTML block, desktop/375 px |
| 3D | PASS: сгенерированный тестовый GLB действительно загружен существующим model-viewer 3.5.0, атрибут `ar` отсутствует; отдельная проверка отказа загрузки 3D-плеера → Retry → успешный GLB тоже PASS |
| Безопасность snippet | Node tests отклоняют credentials/javascript/неразрешённый HTTP, экранируют title, убирают query/hash, ограничивают высоту |
| Shell / diff | `bash -n deploy/selectel-deploy.sh`, `git diff --check` PASS |

WordPress-страница сохранена локальным администратором через `wp_insert_post` с обычными content filters, затем открыта браузером. Ручной ввод/сохранение через интерфейс Gutenberg не автоматизировались. Тестовый public payload обслуживался локальным fixture HTTP server; серверные инварианты проверены отдельно через Go handlers/SQLite. Это не production E2E с реальными музейными данными.

React Doctor запущен для обоих интерфейсов. У кабинета — 6 предупреждений в существующих PublicationDelivery/ContentWorkspace, вне добавленного embed UI; создание/revoke object URL уже обрабатываются разделёнными helper/effect. Visitor scope changed сообщил отсутствие диагностик, но общий score 54; этот score не используется как доказательство качества новой функции. Полный аудит старого приложения в задачу не входил.

## Воспроизведение browser smoke

Нужны установленный Playwright/Chromium либо локальный Chrome; зависимости приложения не расширены ради проверки. После сборки Visitor запустить `Frontend/Visitor/scripts/embed-browser-smoke.cjs`; при необходимости задать `PLAYWRIGHT_MODULE` и `CHROME_EXECUTABLE`. Скрипт поднимает два локальных origin 5188/5189 и проверяет production build на тестовых данных. Порты должны быть свободны. JSON и screenshots сохраняются в `Frontend/Visitor/output/embed-qa/` (ignored).

Локальные дополнительные свидетельства текущего запуска: `output/embed-qa/`: browser-results.json, creator-results.json, wordpress-results.json, model-results.json, model-retry-results.json и PNG. Они не содержат production-данных и не выдаются за реальные музейные экспонаты.

## Не проверено / перед публикацией

- PostgreSQL migration/upsert не запускались на живой PostgreSQL в этом окружении: Docker daemon отсутствует. Основные handler/lifecycle tests использовали SQLite. Нужна интеграционная проверка миграции и счётчика в окружении PostgreSQL перед выпуском.
- nginx/Caddy binaries отсутствуют локально: runtime validation конфигурации и реальные proxy headers не подтверждены. Локальный fixture выставлял соответствующие headers, что не заменяет `nginx -t` / Caddy validation на целевом окружении.
- Штатный Selectel deploy не заменяет active nginx config. Шаблон включён в release archive; **до показа функции на production** оператор должен применить проверенные location/header правила к активному vhost, сохранить его дополнительные настройки, проверить config и выполнить reload. Не перезаписывать активный конфиг вслепую.
- Production access/error/CDN logs и правовое основание обработки не проверены; счётчик default off. Настройка `access_log off` в шаблоне не является юридическим заключением и не доказывает отсутствие всех инфраструктурных записей.
- Firefox, Safari/iOS, реальное увеличение интерфейса браузера до 200%, редактор Gutenberg и плагины/permissions конкретного WordPress-сайта не проверены. Проверка мобильных ширин выполнена в desktop Chrome, не на физических телефонах.
- В этой задаче не выполнялись commit/push, PR, применение миграции к production или deploy.

## Исправление оформления по замечанию пользователя

Пользователь уточнил, что дизайн самого iframe должен соответствовать действующему плееру. Отдельный упрощённый EmbedPlayer заменён общим `StoryExperienceView` и неизменённым `story.css`: фон, типографика, расположение текста, вертикальные индикаторы, quiz feedback и экран завершения теперь общие. В embed CSS остаются только размещение в контейнере и компактная подпись платформы.

Для сохранения изоляции дефолтная route-аналитика вынесена в тонкий `TrackedStoryExperience`, загружаемый только обычным приложением. Общий визуальный компонент не импортирует analytics bootstrap; режим embedded отключает таймеры/track callbacks, коллекцию и feedback, сохраняет просмотр модели без AR и даёт повтор истории. Для обычного просмотра кнопки/аналитика сохраняют прежнее назначение; повтор истории добавлен только в iframe.

Проверки после изменения: Visitor lint/typecheck/smoke/build и Node normalization test PASS; повторный browser smoke по общему плееру PASS (4 ширины, quiz/completion, XSS, blocked storage, preview/count и отсутствие behavioural requests). В открытом IAB WordPress выполнен reload и проверен общий интерфейс; отдельный preview показал обложку с существующим демонстрационным изображением и переход к вопросу. Скриншот `output/embed-qa/design-cover.png`. Объединение дизайна подтверждается использованием одного компонента и одного stylesheet, браузерной проверкой и screenshot.

## Подготовка рабочего выпуска и старые публикации

По дополнительному поручению пользователя: прямой entry в списке опубликованных экспонатов, совместимость 5- и 10-символьных public codes в standalone/embed/snippet. Go regression test проверяет старый снимок с более новым draft и отсутствие повторной публикации; Node test проверяет код iframe для legacy URL. Go race/vet, оба frontend check, 32 tests кабинета, normalization test Visitor PASS.

Установка nginx теперь включена в deploy; patch идемпотентен, неизвестная конфигурация отклоняется, backup и rollback предусмотрены. Python patch tests и shell syntax PASS. Отдельная проверка после выпуска читает только метаданные существующих публикаций и проверяет PostgreSQL UPSERT в ROLLBACK-транзакции, HTTPS embed и framing кабинета. Фактический итог выпуска фиксируется ниже после завершения workflow.
