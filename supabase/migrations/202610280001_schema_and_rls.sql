-- Esquema base de SmartStock para Supabase.
-- Diseñado para un proyecto nuevo. Antes de ejecutarlo en un proyecto existente,
-- compara la salida de supabase/diagnostics/audit.sql.

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  correo text not null unique check (correo = lower(correo)),
  rol text not null default 'cliente' check (rol in ('admin', 'cliente')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'activo', 'inactivo')),
  fecha_creacion timestamptz not null default now()
);

create table if not exists public.clientes (
  id bigint generated always as identity primary key,
  id_usuario uuid not null unique references public.perfiles(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) >= 2),
  apellido text not null check (char_length(trim(apellido)) >= 2),
  fecha_creacion timestamptz not null default now()
);

create table if not exists public.productos (
  id bigint generated always as identity primary key,
  nombre text not null check (char_length(trim(nombre)) >= 2),
  descripcion text not null,
  valor_unitario numeric(14, 2) not null check (valor_unitario > 0),
  stock integer not null default 0 check (stock >= 0)
);

create table if not exists public.encabezados (
  id bigint generated always as identity primary key,
  id_cliente bigint not null references public.clientes(id) on delete restrict,
  fecha timestamptz not null default now(),
  total numeric(24, 2) not null default 0 check (total >= 0)
);

create table if not exists public.detalles (
  id bigint generated always as identity primary key,
  id_encabezado bigint not null references public.encabezados(id) on delete cascade,
  id_producto bigint not null references public.productos(id) on delete restrict,
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(14, 2) not null check (precio_unitario > 0),
  valor numeric(24, 2) generated always as (cantidad * precio_unitario) stored,
  unique (id_encabezado, id_producto)
);

create index if not exists clientes_usuario_idx on public.clientes(id_usuario);
create index if not exists encabezados_cliente_idx on public.encabezados(id_cliente);
create index if not exists encabezados_fecha_idx on public.encabezados(fecha desc);
create index if not exists detalles_encabezado_idx on public.detalles(id_encabezado);
create index if not exists detalles_producto_idx on public.detalles(id_producto);

create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, correo, rol, estado)
  values (new.id, lower(new.email), 'cliente', 'pendiente')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Elimina únicamente disparadores anteriores que llamen a esta misma función.
-- Así la migración puede repetirse sin crear dos perfiles por registro.
do $$
declare
  v_trigger record;
begin
  for v_trigger in
    select triggers.tgname
    from pg_catalog.pg_trigger as triggers
    join pg_catalog.pg_proc as functions
      on functions.oid = triggers.tgfoid
    join pg_catalog.pg_namespace as schemas
      on schemas.oid = functions.pronamespace
    where triggers.tgrelid = 'auth.users'::regclass
      and not triggers.tgisinternal
      and schemas.nspname = 'public'
      and functions.proname = 'crear_perfil_usuario'
  loop
    execute format('drop trigger %I on auth.users', v_trigger.tgname);
  end loop;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.crear_perfil_usuario();

revoke all on function public.crear_perfil_usuario() from public;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles
    where id = auth.uid()
      and rol = 'admin'
      and estado = 'activo'
  );
$$;

create or replace function public.es_usuario_activo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles
    where id = auth.uid()
      and estado = 'activo'
  );
$$;

revoke all on function public.es_admin() from public;
revoke all on function public.es_usuario_activo() from public;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.es_usuario_activo() to authenticated;

alter table public.perfiles enable row level security;
alter table public.clientes enable row level security;
alter table public.productos enable row level security;
alter table public.encabezados enable row level security;
alter table public.detalles enable row level security;

drop policy if exists "perfiles_select_propio_o_admin" on public.perfiles;
create policy "perfiles_select_propio_o_admin"
on public.perfiles for select to authenticated
using (id = auth.uid() or public.es_admin());

drop policy if exists "perfiles_update_admin" on public.perfiles;
create policy "perfiles_update_admin"
on public.perfiles for update to authenticated
using (public.es_admin())
with check (public.es_admin());

drop policy if exists "clientes_select_propio_o_admin" on public.clientes;
create policy "clientes_select_propio_o_admin"
on public.clientes for select to authenticated
using (
  public.es_usuario_activo()
  and (id_usuario = auth.uid() or public.es_admin())
);

drop policy if exists "clientes_insert_propio_o_admin" on public.clientes;
create policy "clientes_insert_propio_o_admin"
on public.clientes for insert to authenticated
with check (
  public.es_usuario_activo()
  and (id_usuario = auth.uid() or public.es_admin())
);

drop policy if exists "clientes_update_propio_o_admin" on public.clientes;
create policy "clientes_update_propio_o_admin"
on public.clientes for update to authenticated
using (
  public.es_usuario_activo()
  and (id_usuario = auth.uid() or public.es_admin())
)
with check (
  public.es_usuario_activo()
  and (id_usuario = auth.uid() or public.es_admin())
);

drop policy if exists "clientes_delete_admin" on public.clientes;
create policy "clientes_delete_admin"
on public.clientes for delete to authenticated
using (public.es_admin());

drop policy if exists "productos_select_activos" on public.productos;
create policy "productos_select_activos"
on public.productos for select to authenticated
using (public.es_usuario_activo());

drop policy if exists "productos_insert_admin" on public.productos;
create policy "productos_insert_admin"
on public.productos for insert to authenticated
with check (public.es_admin());

drop policy if exists "productos_update_admin" on public.productos;
create policy "productos_update_admin"
on public.productos for update to authenticated
using (public.es_admin())
with check (public.es_admin());

drop policy if exists "productos_delete_admin" on public.productos;
create policy "productos_delete_admin"
on public.productos for delete to authenticated
using (public.es_admin());

drop policy if exists "encabezados_select_propio_o_admin" on public.encabezados;
create policy "encabezados_select_propio_o_admin"
on public.encabezados for select to authenticated
using (
  public.es_usuario_activo()
  and (
    public.es_admin()
    or exists (
      select 1 from public.clientes
      where clientes.id = encabezados.id_cliente
        and clientes.id_usuario = auth.uid()
    )
  )
);

drop policy if exists "detalles_select_propio_o_admin" on public.detalles;
create policy "detalles_select_propio_o_admin"
on public.detalles for select to authenticated
using (
  public.es_usuario_activo()
  and exists (
    select 1
    from public.encabezados
    where encabezados.id = detalles.id_encabezado
  )
);

grant select on public.perfiles, public.clientes, public.productos, public.encabezados, public.detalles to authenticated;
grant insert, update, delete on public.perfiles, public.clientes, public.productos to authenticated;
grant usage, select on all sequences in schema public to authenticated;
