#!/bin/sh
set -eu

# The official image creates only POSTGRES_DB.  Each service owns a separate
# database, so create the remaining local-development databases exactly once
# during cluster initialization.
for database in ${POSTGRES_MULTIPLE_DATABASES:-}; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set=database_name="$database" <<'EOSQL'
SELECT format('CREATE DATABASE %I', :'database_name')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'database_name')\gexec
EOSQL
done
