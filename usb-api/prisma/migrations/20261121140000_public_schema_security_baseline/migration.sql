-- Public schema security baseline for the server-only Prisma data model.
-- The Kitchen API uses its server-side PostgreSQL connection (postgres role).
-- Browser-facing Supabase roles must not access operational tables directly.

BEGIN;

-- Remove access from the browser-facing Supabase roles from current objects.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Keep future Prisma-created objects private by default.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- Some Supabase-managed installations have objects created as supabase_admin.
-- CI uses plain PostgreSQL where that role may not exist, so apply conditionally.
DO $security$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated';
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
