import fs from 'node:fs';
import process from 'node:process';

import { createClient } from '@supabase/supabase-js';

function readEnvFile(path) {
  if (!fs.existsSync(path)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}

const values = {
  ...readEnvFile('.env'),
  ...readEnvFile('.env.test.local'),
  ...process.env,
};

const required = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'TEST_ADMIN_EMAIL',
  'TEST_ADMIN_PASSWORD',
  'TEST_CLIENT_EMAIL',
  'TEST_CLIENT_PASSWORD',
];

const missing = required.filter((name) => !values[name]);
if (missing.length) {
  console.error(`Faltan variables de prueba: ${missing.join(', ')}`);
  console.error('Copia .env.test.example como .env.test.local y completa cuentas de prueba activas.');
  process.exit(1);
}

function client() {
  return createClient(
    values.EXPO_PUBLIC_SUPABASE_URL,
    values.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

const anonymous = client();
const admin = client();
const customer = client();
let temporaryProductId = null;

try {
  const anonymousRead = await anonymous.from('productos').select('id').limit(1);
  assert(
    !anonymousRead.error && anonymousRead.data.length === 0,
    'El usuario anónimo no puede consultar productos'
  );

  const adminLogin = await admin.auth.signInWithPassword({
    email: values.TEST_ADMIN_EMAIL,
    password: values.TEST_ADMIN_PASSWORD,
  });
  if (adminLogin.error) throw adminLogin.error;

  const customerLogin = await customer.auth.signInWithPassword({
    email: values.TEST_CLIENT_EMAIL,
    password: values.TEST_CLIENT_PASSWORD,
  });
  if (customerLogin.error) throw customerLogin.error;

  const adminProfile = await admin
    .from('perfiles')
    .select('id, rol, estado')
    .eq('id', adminLogin.data.user.id)
    .single();
  if (adminProfile.error) throw adminProfile.error;
  assert(
    adminProfile.data.rol === 'admin' && adminProfile.data.estado === 'activo',
    'La cuenta administradora tiene rol admin y estado activo'
  );

  const customerProfile = await customer
    .from('perfiles')
    .select('id, rol, estado')
    .eq('id', customerLogin.data.user.id)
    .single();
  if (customerProfile.error) throw customerProfile.error;
  assert(
    customerProfile.data.rol === 'cliente' && customerProfile.data.estado === 'activo',
    'La cuenta cliente tiene rol cliente y estado activo'
  );

  const productName = `Prueba RLS ${Date.now()}`;
  const createdProduct = await admin
    .from('productos')
    .insert({
      nombre: productName,
      descripcion: 'Registro temporal creado por la prueba automática de RLS',
      valor_unitario: 1000,
      stock: 3,
    })
    .select('id, nombre, stock')
    .single();
  if (createdProduct.error) throw createdProduct.error;
  temporaryProductId = createdProduct.data.id;
  assert(Boolean(temporaryProductId), 'El administrador puede crear productos');

  const customerRead = await customer
    .from('productos')
    .select('id')
    .eq('id', temporaryProductId)
    .single();
  assert(!customerRead.error && customerRead.data.id === temporaryProductId, 'El cliente activo puede consultar productos');

  const forbiddenInsert = await customer.from('productos').insert({
    nombre: 'Producto no autorizado',
    descripcion: 'Esta inserción debe ser bloqueada por RLS',
    valor_unitario: 1000,
    stock: 1,
  });
  assert(Boolean(forbiddenInsert.error), 'RLS impide que el cliente cree productos');

  const customerClients = await customer
    .from('clientes')
    .select('id, id_usuario');
  if (customerClients.error) throw customerClients.error;
  assert(
    customerClients.data.every((row) => row.id_usuario === customerLogin.data.user.id),
    'El cliente solo puede consultar su propio registro de cliente'
  );

  const ownClientId = customerClients.data[0]?.id;
  const customerPurchases = await customer
    .from('encabezados')
    .select('id, id_cliente');
  if (customerPurchases.error) throw customerPurchases.error;
  assert(
    customerPurchases.data.every((row) => row.id_cliente === ownClientId),
    'El cliente solo puede consultar sus propios encabezados de compra'
  );

  const forbiddenUpdate = await customer
    .from('productos')
    .update({ stock: 99 })
    .eq('id', temporaryProductId)
    .select('id');
  assert(
    Boolean(forbiddenUpdate.error) || forbiddenUpdate.data.length === 0,
    'RLS impide que el cliente modifique productos'
  );

  const unchangedProduct = await admin
    .from('productos')
    .select('stock')
    .eq('id', temporaryProductId)
    .single();
  if (unchangedProduct.error) throw unchangedProduct.error;
  assert(unchangedProduct.data.stock === 3, 'El intento no autorizado no alteró el inventario');

  console.log('\nPruebas RLS completadas correctamente.');
} catch (error) {
  console.error(`\n✗ Prueba fallida: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  if (temporaryProductId) {
    const cleanup = await admin.from('productos').delete().eq('id', temporaryProductId);
    if (cleanup.error) {
      console.error(`No fue posible eliminar el producto temporal: ${cleanup.error.message}`);
      process.exitCode = 1;
    } else {
      console.log('✓ Producto temporal eliminado');
    }
  }

  await Promise.all([admin.auth.signOut(), customer.auth.signOut()]);
}
