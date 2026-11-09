-- Existing values remain available to legacy clients. New listings need no SKU.
alter table public.parts alter column sku drop not null;
