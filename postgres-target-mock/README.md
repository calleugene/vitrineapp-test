# ViraLabs PostgreSQL target mock

Набор соответствует target ER на странице 7. Target ER в VIRALABS_ARCHITECTURE.drawio.

Запуск:

    createdb viralabs_target
    psql -d viralabs_target -f schema.sql
    psql -d viralabs_target -f seed.sql
    psql -d viralabs_target -f verify.sql

Создаются схемы identity, content, visitor и analytics. Cross-service IDs остаются soft references; hard FK используются внутри владельца данных.

seed.sql генерирует ровно 30 детерминированных строк для каждой из 35 таблиц через generate_series(1,30). Повторный запуск не дублирует строки благодаря ON CONFLICT DO NOTHING.
