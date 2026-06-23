-- 0004: per-member admin PIN (hashed). Trusted-device model; replaces hardcoded ADMIN_PIN constant.
alter table family_members add column if not exists pin_hash text;
