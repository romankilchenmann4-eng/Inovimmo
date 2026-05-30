-- Drop legacy mieter_id column from wohnungen
-- The correct tenant relationship is through mietverhaeltnisse.mieter_id,
-- not wohnungen.mieter_id (which references profiles instead of mieter).

-- Drop the index first if it exists
DROP INDEX IF EXISTS public.idx_wohnungen_mieter;

-- Drop the foreign key constraint if it exists
ALTER TABLE public.wohnungen DROP CONSTRAINT IF EXISTS wohnungen_mieter_id_fkey;

-- Drop the column
ALTER TABLE public.wohnungen DROP COLUMN IF EXISTS mieter_id;