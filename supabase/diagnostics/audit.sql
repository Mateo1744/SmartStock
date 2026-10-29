-- Consulta de solo lectura. Ejecuta este archivo antes de aplicar migraciones.
-- Permite comparar la estructura real del proyecto con la esperada por la app.

select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.constraint_schema = kcu.constraint_schema
left join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name
 and tc.constraint_schema = ccu.constraint_schema
where tc.table_schema = 'public'
order by tc.table_name, tc.constraint_type, tc.constraint_name;

select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select
  routine_name,
  routine_type
from information_schema.routines
where routine_schema = 'public'
order by routine_name;

-- Resumen final: Supabase muestra este bloque al ejecutar el archivo completo.
select
  tables.tablename,
  tables.rowsecurity as rls_activo,
  count(policies.policyname) as cantidad_politicas,
  coalesce(
    string_agg(policies.policyname || ' [' || policies.cmd || ']', ', ' order by policies.policyname),
    'SIN POLITICAS'
  ) as politicas
from pg_tables as tables
left join pg_policies as policies
  on policies.schemaname = tables.schemaname
 and policies.tablename = tables.tablename
where tables.schemaname = 'public'
  and tables.tablename in ('perfiles', 'clientes', 'productos', 'encabezados', 'detalles')
group by tables.tablename, tables.rowsecurity
order by tables.tablename;
