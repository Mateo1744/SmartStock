-- Consulta de solo lectura para verificar usuarios y perfiles creados.
select
  usuarios.id,
  usuarios.email,
  usuarios.email_confirmed_at,
  usuarios.created_at,
  perfiles.rol,
  perfiles.estado,
  perfiles.correo as correo_perfil
from auth.users as usuarios
left join public.perfiles as perfiles on perfiles.id = usuarios.id
order by usuarios.created_at desc;
