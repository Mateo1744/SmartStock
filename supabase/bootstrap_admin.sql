-- Ejecutar una sola vez después de registrar la cuenta administradora en Auth.
update public.perfiles as perfiles
set rol = 'admin', estado = 'activo'
from auth.users as usuarios
where perfiles.id = usuarios.id
  and lower(usuarios.email) = 'davidnaranjo337@gmail.com';

-- Verifica que la cuenta haya quedado como administradora activa.
select perfiles.id, usuarios.email, perfiles.rol, perfiles.estado
from public.perfiles as perfiles
join auth.users as usuarios on usuarios.id = perfiles.id
where lower(usuarios.email) = 'davidnaranjo337@gmail.com';
