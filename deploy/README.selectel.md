# Автоматический деплой на Selectel

Рабочая ветка сервера — `production`. Каждый push в неё запускает `.github/workflows/deploy-selectel.yml`; ручной запуск доступен через **Actions → Deploy to Selectel → Run workflow**.

Исходники главной страницы находятся в `Landing/`, кабинета методиста — в `Frontend/MetodistPanel/`, интерфейса посетителя — в `Frontend/Visitor/`. GitHub Actions собирает все три интерфейса, отправляет архив на `135.106.175.94`, затем последовательно собирает и обновляет восемь API-сервисов. После деплоя проверяются HTTPS-страницы и основные API.

Для подключения используется отдельный SSH-ключ в секрете репозитория `SELECTEL_DEPLOY_KEY`. Публичный ключ сервера закреплён в `deploy/selectel_known_hosts`. Секреты приложений находятся только в `/opt/vitrineapp/.env` и `/var/www/vitrina/private/smtp-config.php` на сервере. PostgreSQL и загруженные медиа хранятся в Docker-томах `vitrineapp_postgres_data` и `vitrineapp_artifacts_service_data`; архив деплоя их не заменяет.

Активная версия записана в `/opt/vitrineapp/deployed-revision`, исходники релиза — в `/opt/vitrineapp/current`. Логи: `docker compose -p vitrineapp --env-file /opt/vitrineapp/.env -f /opt/vitrineapp/current/docker-compose.yml -f /opt/vitrineapp/current/deploy/compose.selectel.yml logs --tail=100`.

## iframe экспоната — S-011

Сборка Visitor содержит отдельный `embed.html`; публичный путь — `/embed/exhibits/{publicCode}`. Коды существующих публикаций сохраняются: поддержаны текущие 5 символов и старые 10 шестнадцатеричных символов. В меню опубликованного экспоната есть прямой пункт «Встроить на сайт»; код также доступен в разделе «Публикация».

Штатный скрипт запускает `install-embed-nginx.py`: он находит единственный существующий Vitrina vhost по домену и document root, добавляет include `nginx-embed.locations.conf`, защищает `/methodist/` от внешнего framing, сохраняет backup в `/opt/vitrineapp/nginx-backups/{revision}`, выполняет `nginx -t` и reload. Неизвестный layout конфигурации приводит к отказу без догадок; ошибка проверки/reload восстанавливает предыдущие файлы. Весь активный vhost шаблоном не заменяется. Для Docker/Caddy соответствующая маршрутизация находится в `deploy/Caddyfile`.

После релиза `verify-embed-release.py` проверяет реальную таблицу PostgreSQL и UPSERT в откатываемой транзакции, до 10 существующих snapshot/API/HTTPS embed-документов (старые коды первыми) и framing protection кабинета. Контент экспонатов не изменяется и не публикуется заново.
Миграция агрегатов `0007_embed_opens.postgres.sql` применяется штатным запуском artifacts-service. `ARTIFACTS_EMBED_COUNTING_ENABLED` по умолчанию false; установить true можно после проверки фактических access/error/CDN logs и условий обработки по D-004. Пустой POST счётчика не хранит visitor records; агрегат UTC-дня содержит только artifact/day/opens. В кабинете показано, включён ли сбор. Preview не учитывается, повторные открытия не дедуплицируются между страницами.

Проверка без реального музейного контента: `/embed/exhibits/00000` должен отдать embed HTML, а интерфейс — безопасное состояние недоступного объекта, если такого кода нет. Не публиковать реальные данные ради smoke test. Полная локальная проверка и ограничения: `backlog/reports/S-011-exhibit-iframe-validation.md`.
