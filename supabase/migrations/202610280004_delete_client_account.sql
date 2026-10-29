-- Elimina una cuenta cliente completa únicamente si no posee compras.
-- La función vive en el servidor porque la app nunca debe contener una clave secreta.

create or replace function public.eliminar_cuenta_cliente(p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente_id bigint;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede eliminar cuentas.';
  end if;

  select id into v_cliente_id
  from public.clientes
  where id_usuario = p_usuario_id;

  if v_cliente_id is null then
    raise exception 'La cuenta cliente no existe.';
  end if;

  if exists (
    select 1 from public.encabezados where id_cliente = v_cliente_id
  ) then
    raise exception 'El cliente tiene compras registradas y no puede eliminarse.';
  end if;

  delete from auth.users
  where id = p_usuario_id;
end;
$$;

revoke all on function public.eliminar_cuenta_cliente(uuid) from public;
grant execute on function public.eliminar_cuenta_cliente(uuid) to authenticated;
