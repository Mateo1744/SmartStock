-- Operaciones de compra atómicas. Toda modificación de inventario se ejecuta
-- dentro de la misma transacción que los encabezados y detalles.

create or replace function public.puede_gestionar_compra(p_compra_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.es_admin() or exists (
    select 1
    from public.encabezados e
    join public.clientes c on c.id = e.id_cliente
    where e.id = p_compra_id
      and c.id_usuario = auth.uid()
      and public.es_usuario_activo()
  );
$$;

create or replace function public.recalcular_total_compra(p_compra_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.encabezados
  set total = coalesce((
    select sum(valor)
    from public.detalles
    where id_encabezado = p_compra_id
  ), 0)
  where id = p_compra_id;
$$;

create or replace function public.crear_compra(
  p_items jsonb,
  p_cliente_id bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente_id bigint;
  v_compra_id bigint;
  v_item jsonb;
  v_producto public.productos%rowtype;
  v_producto_id bigint;
  v_cantidad integer;
begin
  if not public.es_usuario_activo() then
    raise exception 'Tu cuenta no está activa.';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Selecciona al menos un producto.';
  end if;

  if public.es_admin() then
    v_cliente_id := p_cliente_id;
  else
    select id into v_cliente_id
    from public.clientes
    where id_usuario = auth.uid();
  end if;

  if v_cliente_id is null or not exists (select 1 from public.clientes where id = v_cliente_id) then
    raise exception 'No existe un perfil de cliente válido para registrar la compra.';
  end if;

  insert into public.encabezados (id_cliente, total)
  values (v_cliente_id, 0)
  returning id into v_compra_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_producto_id := (v_item ->> 'productId')::bigint;
    v_cantidad := (v_item ->> 'quantity')::integer;

    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Las cantidades deben ser números enteros mayores que cero.';
    end if;

    select * into v_producto
    from public.productos
    where id = v_producto_id
    for update;

    if not found then
      raise exception 'Uno de los productos ya no existe.';
    end if;

    if v_producto.stock < v_cantidad then
      raise exception 'No hay suficiente stock de %. Disponible: %.', v_producto.nombre, v_producto.stock;
    end if;

    update public.productos
    set stock = stock - v_cantidad
    where id = v_producto.id;

    insert into public.detalles (
      id_encabezado,
      id_producto,
      cantidad,
      precio_unitario
    ) values (
      v_compra_id,
      v_producto.id,
      v_cantidad,
      v_producto.valor_unitario
    );
  end loop;

  perform public.recalcular_total_compra(v_compra_id);
  return v_compra_id;
end;
$$;

create or replace function public.eliminar_compra(p_compra_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_detalle record;
begin
  if not public.puede_gestionar_compra(p_compra_id) then
    raise exception 'No tienes permiso para eliminar esta compra.';
  end if;

  for v_detalle in
    select id_producto, cantidad
    from public.detalles
    where id_encabezado = p_compra_id
    for update
  loop
    update public.productos
    set stock = stock + v_detalle.cantidad
    where id = v_detalle.id_producto;
  end loop;

  delete from public.encabezados where id = p_compra_id;
end;
$$;

create or replace function public.actualizar_cantidad_detalle(
  p_detalle_id bigint,
  p_nueva_cantidad integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_detalle public.detalles%rowtype;
  v_stock integer;
  v_diferencia integer;
begin
  if p_nueva_cantidad is null or p_nueva_cantidad <= 0 then
    raise exception 'La cantidad debe ser un número entero mayor que cero.';
  end if;

  select * into v_detalle
  from public.detalles
  where id = p_detalle_id
  for update;

  if not found or not public.puede_gestionar_compra(v_detalle.id_encabezado) then
    raise exception 'No existe el detalle o no tienes permiso para modificarlo.';
  end if;

  select stock into v_stock
  from public.productos
  where id = v_detalle.id_producto
  for update;

  v_diferencia := p_nueva_cantidad - v_detalle.cantidad;
  if v_diferencia > 0 and v_stock < v_diferencia then
    raise exception 'No hay suficiente stock. Disponible para agregar: %.', v_stock;
  end if;

  update public.productos
  set stock = stock - v_diferencia
  where id = v_detalle.id_producto;

  update public.detalles
  set cantidad = p_nueva_cantidad
  where id = p_detalle_id;

  perform public.recalcular_total_compra(v_detalle.id_encabezado);
end;
$$;

create or replace function public.agregar_detalle_compra(
  p_compra_id bigint,
  p_producto_id bigint,
  p_cantidad integer
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_producto public.productos%rowtype;
  v_detalle_id bigint;
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser un número entero mayor que cero.';
  end if;

  if not public.puede_gestionar_compra(p_compra_id) then
    raise exception 'No tienes permiso para modificar esta compra.';
  end if;

  if exists (
    select 1 from public.detalles
    where id_encabezado = p_compra_id and id_producto = p_producto_id
  ) then
    raise exception 'Ese producto ya está incluido en la compra. Edita su cantidad.';
  end if;

  select * into v_producto
  from public.productos
  where id = p_producto_id
  for update;

  if not found then
    raise exception 'El producto seleccionado ya no existe.';
  end if;

  if v_producto.stock < p_cantidad then
    raise exception 'No hay suficiente stock de %. Disponible: %.', v_producto.nombre, v_producto.stock;
  end if;

  update public.productos
  set stock = stock - p_cantidad
  where id = p_producto_id;

  insert into public.detalles (id_encabezado, id_producto, cantidad, precio_unitario)
  values (p_compra_id, p_producto_id, p_cantidad, v_producto.valor_unitario)
  returning id into v_detalle_id;

  perform public.recalcular_total_compra(p_compra_id);
  return v_detalle_id;
end;
$$;

create or replace function public.eliminar_detalle_compra(p_detalle_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_detalle public.detalles%rowtype;
  v_cantidad_detalles integer;
begin
  select * into v_detalle
  from public.detalles
  where id = p_detalle_id
  for update;

  if not found or not public.puede_gestionar_compra(v_detalle.id_encabezado) then
    raise exception 'No existe el detalle o no tienes permiso para eliminarlo.';
  end if;

  select count(*) into v_cantidad_detalles
  from public.detalles
  where id_encabezado = v_detalle.id_encabezado;

  if v_cantidad_detalles <= 1 then
    raise exception 'Una compra debe conservar al menos un detalle. Elimina la compra completa.';
  end if;

  update public.productos
  set stock = stock + v_detalle.cantidad
  where id = v_detalle.id_producto;

  delete from public.detalles where id = p_detalle_id;
  perform public.recalcular_total_compra(v_detalle.id_encabezado);
end;
$$;

revoke all on function public.puede_gestionar_compra(bigint) from public;
revoke all on function public.recalcular_total_compra(bigint) from public;
revoke all on function public.crear_compra(jsonb, bigint) from public;
revoke all on function public.eliminar_compra(bigint) from public;
revoke all on function public.actualizar_cantidad_detalle(bigint, integer) from public;
revoke all on function public.agregar_detalle_compra(bigint, bigint, integer) from public;
revoke all on function public.eliminar_detalle_compra(bigint) from public;

grant execute on function public.crear_compra(jsonb, bigint) to authenticated;
grant execute on function public.eliminar_compra(bigint) to authenticated;
grant execute on function public.actualizar_cantidad_detalle(bigint, integer) to authenticated;
grant execute on function public.agregar_detalle_compra(bigint, bigint, integer) to authenticated;
grant execute on function public.eliminar_detalle_compra(bigint) to authenticated;
