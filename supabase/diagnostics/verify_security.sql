-- Auditoría de solo lectura para evidenciar el modelo relacional y la seguridad.

select
  tables.tablename,
  tables.rowsecurity as rls_activo,
  count(policies.policyname) as cantidad_politicas,
  string_agg(
    distinct policies.cmd || ': ' || policies.policyname,
    E'\n' order by policies.cmd || ': ' || policies.policyname
  ) as politicas
from pg_catalog.pg_tables as tables
left join pg_catalog.pg_policies as policies
  on policies.schemaname = tables.schemaname
 and policies.tablename = tables.tablename
where tables.schemaname = 'public'
  and tables.tablename in ('perfiles', 'clientes', 'productos', 'encabezados', 'detalles')
group by tables.tablename, tables.rowsecurity
order by tables.tablename;

select
  constraints.table_name,
  constraints.constraint_type,
  constraints.constraint_name
from information_schema.table_constraints as constraints
where constraints.table_schema = 'public'
  and constraints.table_name in ('perfiles', 'clientes', 'productos', 'encabezados', 'detalles')
  and constraints.constraint_type in ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK')
order by constraints.table_name, constraints.constraint_type, constraints.constraint_name;

select
  routines.routine_name,
  routines.routine_type
from information_schema.routines as routines
where routines.specific_schema = 'public'
  and routines.routine_name in (
    'crear_compra',
    'eliminar_compra',
    'actualizar_cantidad_detalle',
    'agregar_detalle_compra',
    'eliminar_detalle_compra',
    'eliminar_cuenta_cliente'
  )
order by routines.routine_name;
