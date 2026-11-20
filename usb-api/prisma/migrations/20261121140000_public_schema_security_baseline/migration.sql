-- Public schema security baseline for the server-only Prisma data model.
-- The Kitchen API uses its server-side PostgreSQL connection (postgres role).
-- Browser-facing Supabase roles must not access operational tables directly.

BEGIN;

-- Supabase creates anon/authenticated roles; plain PostgreSQL CI does not.
-- Build a safely quoted role list so the same migration works in both environments.
DO $security$
DECLARE
  v_browser_roles text;
BEGIN
  SELECT string_agg(quote_ident(rolname), ', ')
    INTO v_browser_roles
  FROM pg_roles
  WHERE rolname IN ('anon', 'authenticated');

  IF v_browser_roles IS NOT NULL THEN
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %s',
      v_browser_roles
    );
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %s',
      v_browser_roles
    );
    EXECUTE format(
      'REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM %s',
      v_browser_roles
    );

    -- Keep future Prisma-created objects private by default.
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM %s',
      v_browser_roles
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %s',
      v_browser_roles
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %s',
      v_browser_roles
    );

  END IF;
END
$security$;

-- These tables are accessed only by the trusted server-side API.
-- postgres and service_role are BYPASSRLS; anon/authenticated have no table grants.
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderBowl" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."KotDailySequence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderStatusEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."KotTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."KotTemplateVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."KotChannelTimingSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InventoryCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."IngredientCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Unit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Ingredient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."IngredientUnitConversion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Allergen" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."IngredientAllergen" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Recipe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RecipeVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RecipeIngredientLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RecipeSubrecipeLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RecipeStep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PurchaseDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PurchaseTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PurchaseSheet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PurchaseLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PurchaseDailySequence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."LeftoverInventoryTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."LeftoverInventoryLine" ENABLE ROW LEVEL SECURITY;

COMMIT;
