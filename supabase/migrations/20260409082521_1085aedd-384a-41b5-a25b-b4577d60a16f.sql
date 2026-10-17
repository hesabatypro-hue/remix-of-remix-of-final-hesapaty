
-- Fix: Inventory deduction trigger (UPDATE doesn't support ORDER BY/LIMIT in plpgsql)
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_print()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _material_id UUID;
  _deduction NUMERIC;
BEGIN
  IF NEW.status = 'printed' AND OLD.status != 'printed' THEN
    _deduction := NEW.total_area;
    
    -- Find the first active material roll of this type with remaining stock
    SELECT id INTO _material_id
    FROM public.inventory_materials 
    WHERE organization_id = NEW.organization_id 
      AND material_type = NEW.material_type 
      AND is_active = true
      AND remaining_length > 0
    ORDER BY remaining_length ASC
    LIMIT 1;
    
    IF _material_id IS NOT NULL THEN
      UPDATE public.inventory_materials 
      SET remaining_length = GREATEST(remaining_length - (_deduction / NULLIF(width, 0)), 0)
      WHERE id = _material_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
