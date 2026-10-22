# Завершённая работа из других чатов

Этот файл ведёт отдельная автоматизация сверки. В него попадает только завершённая работа по панели методиста, сделанная вне продуктового бэклога и подтверждённая кодом и результатами проверок. Одних изменений в Git или сообщения в чате недостаточно. Для каждой записи нужны источник, пользовательский результат, изменённые файлы, проверки и ограничения. Если работа уже есть в `PRODUCT_BACKLOG.md`, здесь её не дублировать. Генератор HTML-отчёта объединяет оба файла по уникальному ID.

## DONE

### EXT-001 · P1 · Собственный контекст музея для методиста

- **Статус:** DONE — реализация завершена и проверена.
- **Источник: «Согласовать привязку пользователя к3» (`01a148d3-0355-7690-997f-bbd1912f3c4c`), проект vitrine.
- **Результат:** регистрация назначает методисту серверный `museum_id`; старый аккаунт может явно и идемпотентно получить свой контекст и новый access token. Панель сохраняет новую сессию только после полного ответа, а после потерянного ответа создания профиля сверяет профиль повторным GET.
- **Файлы:** `Backend/auth-service/internal/auth/{dto.go,handler.go,repository.go,repository_postgres.go,repository_sqlite.go,service.go,service_security_test.go,token.go}`; `Backend/auth-service/MUSEUM_CONTEXT.md`; `Backend/artifacts-service/internal/artifacts/{handler.go,repository_sqlite.go,service.go,museum_context_contract_test.go,museum_flow_integration_test.go}`; `Frontend/MetodistPanel/src/{api.js,app/MuseumSetupScreen.jsx,app/museum-session.js,app/museum-session.test.js,app/use-session.js,features/museum/create-profile.js,features/museum/create-profile.test.js,features/museum/use-museum-profile.js}`.
- **Проверки:** `go test ./internal/auth`, `go test ./internal/artifacts`, `go test -tags=integration ./internal/artifacts -run TestRegistrationToVisitorPublicSnapshot -count=1` прошли; `npm test` — 21/21; `npm run check` (lint, typecheck, build) прошёл; `git diff --check` прошёл (только предупреждения Git LF/CRLF).
- **Ограничения:** браузерный сценарий на PostgreSQL не выполнялся; интеграционный тест использует временную SQLite-базу. Каталог Visitor всё ещё запрашивает фиксированный `mus_001`; прямую публичную ссылку покрывает интеграционный сценарий.

