# Documentación técnica de SmartStock

## Propósito

SmartStock es una aplicación multiplataforma para pequeños negocios que centraliza clientes, productos, inventario y compras. La solución utiliza Supabase como servicio de autenticación y base de datos remota, por lo que la información se conserva y sincroniza entre web y dispositivos móviles.

## Roles y estados

### Administrador

- Revisa solicitudes de acceso.
- Activa o rechaza cuentas.
- Administra clientes y productos.
- Consulta y modifica compras.
- Consulta indicadores de ventas e inventario.

### Cliente

- Completa y actualiza su perfil.
- Consulta productos disponibles.
- Registra compras.
- Consulta únicamente su historial.

Una cuenta puede estar `pendiente`, `activo` o `inactivo`. La confirmación del correo pertenece a Supabase Auth y la aprobación administrativa pertenece al perfil público de SmartStock.

## Arquitectura

### Presentación

`screens` contiene las pantallas, formularios, validaciones visuales, estados de carga y estados vacíos.

### Navegación

`src/app` contiene las rutas de Expo Router. `_layout.tsx` registra las pantallas y el menú común de los módulos privados.

### Autenticación

`src/context/auth-context.tsx` integra Supabase Auth, restaura la sesión, valida el perfil público y controla los estados pendiente, activo e inactivo.

### Acceso a datos

- `src/lib/supabase.ts` inicializa el SDK con variables de entorno.
- `src/database/purchases.ts` invoca funciones PostgreSQL para operaciones transaccionales.
- `src/types/database.ts` define los tipos de tablas y funciones remotas.

### Base de datos

Las migraciones se encuentran en `supabase/migrations` y crean:

1. `perfiles`
2. `clientes`
3. `productos`
4. `encabezados`
5. `detalles`

El modelo utiliza PK, FK, restricciones, índices y columnas calculadas. Los detalles pertenecen a un encabezado y cada encabezado pertenece a un cliente.

## Operaciones de compra

Las funciones PostgreSQL realizan atómicamente las operaciones sensibles:

- Crear una compra.
- Descontar existencias.
- Actualizar cantidades.
- Agregar o eliminar detalles.
- Recalcular el total.
- Eliminar una compra y restaurar el inventario.

Si una validación falla, PostgreSQL revierte la operación completa.

## Seguridad

- Supabase almacena y protege las contraseñas.
- La aplicación utiliza únicamente la clave publicable.
- Las variables se cargan desde `.env`.
- Las cinco tablas públicas tienen RLS habilitado.
- Las políticas separan permisos de administrador y cliente.
- Las funciones sensibles validan el usuario conectado.
- Las funciones `security definer` fijan un `search_path` vacío.
- No se documentan ni almacenan contraseñas en el repositorio.

## Reglas funcionales

1. Una cuenta nueva inicia pendiente de aprobación.
2. Una cuenta pendiente o inactiva no entra al sistema.
3. El cliente completa su perfil después de ser aprobado.
4. Un cliente solo consulta sus datos y compras.
5. El stock nunca puede quedar negativo.
6. Una compra debe contener al menos un detalle.
7. Los totales se calculan a partir de los detalles.
8. Eliminar una compra devuelve las unidades al inventario.
9. Un producto incluido en compras no se elimina directamente.
10. Una cuenta cliente con historial de compras no se elimina.

## Configuración

`.env` debe contener:

```env
EXPO_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
```

Las variables `EXPO_PUBLIC_` son visibles en el cliente, por lo que nunca deben contener la clave `service_role` ni otra credencial privada.

## Ejecución

```powershell
npm install
npm start
```

La aplicación puede abrirse con Expo Go o en web. En modo LAN, el dispositivo y el computador deben compartir la red y Metro debe permanecer abierto.

## Calidad

Antes de una entrega se ejecutan:

```powershell
npm run typecheck
npm run lint
npm run doctor
npm run test:rls
```

También se verifica manualmente el diseño en móvil y web, el comportamiento del teclado, los estados vacíos, el flujo de aprobación y la integridad del inventario.

## Evidencias recomendadas

- Tabla Editor con las cinco tablas.
- Diagrama de relaciones.
- Authentication con usuarios de prueba.
- Políticas RLS activas.
- Resultado de las pruebas de seguridad.
- Flujo de registro, aprobación e inicio de sesión.
- CRUD de productos.
- Compra y actualización del stock.
- Panel de estadísticas.
