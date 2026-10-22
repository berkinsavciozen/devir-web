#!/usr/bin/env bash
# P0-C: migration'ları boş bir Postgres'e sırayla uygular, sonra supabase/test/*.test.sql dosyalarını koşar.
# Kullanım: PGHOST=... PGUSER=postgres PGPASSWORD=... scripts/sql-test.sh   (veritabanı devir_test sıfırdan kurulur)
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${SQL_TEST_DB:-devir_test}
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
export PGOPTIONS="-c client_min_messages=warning"
P="psql -v ON_ERROR_STOP=1 -q -X -d $DB"
$P -f supabase/test/onkosul.sql
n=0
for f in supabase/migrations/*.sql; do
  # pg_net Supabase'e özgü; düz Postgres'te yok. Yalnız uzantıyı kuran satır atlanır (migration başka iş yapmıyor).
  sed 's/^create extension if not exists pg_net;/-- (test) pg_net atlandı/' "$f" | $P -f - || { echo "✗ migration: $f"; exit 1; }
  n=$((n+1))
done
echo "✓ $n migration uygulandı"
for t in supabase/test/*.test.sql; do
  $P -f "$t" || { echo "✗ $t"; exit 1; }
  echo "✓ $(basename "$t")"
done
