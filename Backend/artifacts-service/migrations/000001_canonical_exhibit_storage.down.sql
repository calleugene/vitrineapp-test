-- Deliberately not an automatic rollback.  This migration can contain
-- imported immutable publications and staged media.  Rollback is performed by
-- switching reads/writes to the legacy service during the approved cutover
-- window, not by deleting target history. See MIGRATION_CUTOVER.md.
SELECT 1;
