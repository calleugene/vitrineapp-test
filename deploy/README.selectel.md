# Автоматический деплой на Selectel

Рабочая ветка сервера — `production`. Каждый push в неё запускает `.github/workflows/deploy-selectel.yml`; ручной запуск доступен через **Actions → Deploy to Selectel → Run workflow**.

Исходники главной страницы находятся в `Landing/`, кабинета методиста — в `Frontend/MetodistPanel/`, интерфейса посетителя — в `Frontend/Visitor/`. GitHub Actions собирает все три интерфейса, отправляет архив на `135.106.175.94`, затем последовательно собирает и обновляет восемь API-сервисов. После деплоя проверяются HTTPS-страницы и основные API.

Для подключения используется отдельный SSH-ключ в секрете репозитория `SELECTEL_DEPLOY_KEY`. Публичный ключ сервера закреплён в `deploy/selectel_known_hosts`. Секреты приложений находятся только в `/opt/vitrineapp/.env` и `/var/www/vitrina/private/smtp-config.php` на сервере. PostgreSQL и загруженные медиа хранятся в Docker-томах `vitrineapp_postgres_data` и `vitrineapp_artifacts_service_data`; архив деплоя их не заменяет.

Активная версия записана в `/opt/vitrineapp/deployed-revision`, исходники релиза — в `/opt/vitrineapp/current`. Логи: `docker compose -p vitrineapp --env-file /opt/vitrineapp/.env -f /opt/vitrineapp/current/docker-compose.yml -f /opt/vitrineapp/current/deploy/compose.selectel.yml logs --tail=100`.
