-- =============================================================================
-- Star Sign — usunięcie pozostałości po wtyczce AICO (ai-content-orchestrator).
--
-- UWAGA: uruchamiaj WYŁĄCZNIE ręcznie, po zweryfikowanym backupie bazy
-- (ops/backup-postgres.sh + ops/verify-backup.sh) i tylko na decyzję właściciela.
-- Skrypt jest nieodwracalny (DROP TABLE ... CASCADE) i idempotentny — drugie
-- uruchomienie nic nie psuje.
--
-- Kontekst: wtyczka została usunięta z kodu (treści tworzy zewnętrzny
-- marketing-os przez REST API). W bazie zostają jej tabele i wpisy.
--
-- Użycie:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ops/sql/drop-aico-tables.sql
-- Zatrzymaj API przed uruchomieniem; po nim wystartuj API (Strapi odbuduje schemat).
-- =============================================================================

BEGIN;

-- 1) Tabele wtyczki: aico_* (w tym tabele relacji *_lnk) oraz linki artykułów do person.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = current_schema()
      AND (
        tablename LIKE 'aico\_%'
        OR tablename LIKE '%\_editor\_persona\_lnk'
      )
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', t.tablename);
    RAISE NOTICE 'Usunięto tabelę %', t.tablename;
  END LOOP;
END
$$;

-- 2) Uprawnienia panelu admina (admin_permissions) i ich powiązania z rolami.
DO $$
BEGIN
  IF to_regclass('admin_permissions') IS NOT NULL THEN
    IF to_regclass('admin_permissions_role_lnk') IS NOT NULL THEN
      DELETE FROM admin_permissions_role_lnk
      WHERE permission_id IN (
        SELECT id FROM admin_permissions
        WHERE action LIKE 'plugin::ai-content-orchestrator.%'
           OR subject LIKE 'plugin::ai-content-orchestrator.%'
      );
    END IF;
    DELETE FROM admin_permissions
    WHERE action LIKE 'plugin::ai-content-orchestrator.%'
       OR subject LIKE 'plugin::ai-content-orchestrator.%';
  END IF;
END
$$;

-- 3) Uprawnienia users-permissions i tokenów API (jeśli istnieją wpisy wtyczki).
DO $$
BEGIN
  IF to_regclass('up_permissions') IS NOT NULL THEN
    IF to_regclass('up_permissions_role_lnk') IS NOT NULL THEN
      DELETE FROM up_permissions_role_lnk
      WHERE permission_id IN (
        SELECT id FROM up_permissions
        WHERE action LIKE 'plugin::ai-content-orchestrator.%'
      );
    END IF;
    DELETE FROM up_permissions WHERE action LIKE 'plugin::ai-content-orchestrator.%';
  END IF;

  IF to_regclass('strapi_api_token_permissions') IS NOT NULL THEN
    IF to_regclass('strapi_api_token_permissions_token_lnk') IS NOT NULL THEN
      DELETE FROM strapi_api_token_permissions_token_lnk
      WHERE api_token_permission_id IN (
        SELECT id FROM strapi_api_token_permissions
        WHERE action LIKE 'plugin::ai-content-orchestrator.%'
      );
    END IF;
    DELETE FROM strapi_api_token_permissions
    WHERE action LIKE 'plugin::ai-content-orchestrator.%';
  END IF;
END
$$;

-- 4) Ustawienia wtyczki i konfiguracje widoków w core store.
DO $$
BEGIN
  IF to_regclass('strapi_core_store_settings') IS NOT NULL THEN
    DELETE FROM strapi_core_store_settings
    WHERE key LIKE '%ai-content-orchestrator%'
       OR key LIKE '%aico%';
  END IF;
END
$$;

-- 5) Powiązania plików (media) z nieistniejącymi już typami wtyczki.
DO $$
BEGIN
  IF to_regclass('files_related_mph') IS NOT NULL THEN
    DELETE FROM files_related_mph
    WHERE related_type LIKE 'plugin::ai-content-orchestrator.%';
  END IF;
END
$$;

COMMIT;
