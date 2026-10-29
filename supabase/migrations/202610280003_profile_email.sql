-- Añade el correo al perfil público para que el administrador pueda identificar
-- solicitudes pendientes sin exponer directamente el esquema auth desde la app.

alter table public.perfiles
add column if not exists correo text;

update public.perfiles as perfiles
set correo = lower(usuarios.email)
from auth.users as usuarios
where perfiles.id = usuarios.id
  and perfiles.correo is null;

alter table public.perfiles
alter column correo set not null;

create unique index if not exists perfiles_correo_unico_idx
on public.perfiles (lower(correo));

create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, correo, rol, estado)
  values (new.id, lower(new.email), 'cliente', 'pendiente')
  on conflict (id) do update
    set correo = excluded.correo;
  return new;
end;
$$;

revoke all on function public.crear_perfil_usuario() from public;
