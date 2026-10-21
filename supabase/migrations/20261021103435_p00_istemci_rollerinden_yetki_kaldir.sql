-- Canlıya uygulandı 21 Eki 2026 10:34 (Berkin onayı). Audit N-2 / S-M1: tablolara yalnız sunucu (service_role) erişir; anon ve authenticated hiçbir public nesneye dokunamaz.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
-- Geri alma: grant all on all tables in schema public to anon, authenticated; (ve sequences/functions için aynısı)
