-- Restrict recipe lifecycle trigger functions to the trusted database owner.
-- These functions are invoked by PostgreSQL triggers, not directly from browser clients.

BEGIN;

ALTER FUNCTION public.ukos_recipe_version_guard()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.ukos_recipe_child_draft_guard()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.ukos_recipe_ingredient_line_guard()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.ukos_recipe_subrecipe_line_guard()
  SET search_path = pg_catalog, public;

REVOKE EXECUTE ON FUNCTION public.ukos_recipe_version_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ukos_recipe_child_draft_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ukos_recipe_ingredient_line_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ukos_recipe_subrecipe_line_guard() FROM PUBLIC;

-- Prevent future Prisma-owned public functions from inheriting PUBLIC EXECUTE.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMIT;
