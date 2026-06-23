-- Drop Huddle and Rotation features (schema cleanup)
-- Safe to apply after pages/components were removed in code.

drop table if exists public.huddle_notes;

alter table public.system_zones
  drop column if exists rotation_order,
  drop column if exists rotation_index,
  drop column if exists current_lead_name;
