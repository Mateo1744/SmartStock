/**
 * RESUMEN DEL ARCHIVO
 * Este es el contenedor principal de SmartStock. Comparte la sesión del usuario
 * y registra todas las pantallas de navegación.
 */

// Expo Router crea la pila de pantallas de la aplicación.
import { Stack } from 'expo-router';
// StatusBar controla el aspecto de la barra superior del dispositivo.
import { StatusBar } from 'expo-status-bar';
// AuthProvider guarda el usuario autenticado y ofrece las funciones de sesión.
import { AuthProvider } from '@/context/auth-context';
import { AppMenuButton } from '@/components/app-menu';

export default function RootLayout() {
  // Configuración que agrega navegación global por rol a las pantallas internas.
  const homeMenu = { headerRight: () => <AppMenuButton /> };

  return (
    <AuthProvider>
        {/* Usa iconos oscuros en la barra de estado. */}
        <StatusBar style="dark" />
        {/* Define el diseño común del encabezado y el fondo. */}
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerTransparent: false,
            headerStyle: { backgroundColor: '#F4F7F5' },
            headerTitleAlign: 'center',
            headerTintColor: '#173B32',
            contentStyle: { backgroundColor: '#F4F7F5' },
          }}>
          {/* Rutas públicas y pantalla que decide el destino inicial. */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ title: 'Crear cuenta' }} />
          <Stack.Screen name="home" options={{ headerShown: false }} />
          {/* El perfil es obligatorio en el primer ingreso de un cliente. */}
          <Stack.Screen
            name="perfil"
            options={{ title: 'Completar perfil', headerBackVisible: false, gestureEnabled: false }}
          />
          {/* Módulos principales solicitados en el proyecto. */}
          <Stack.Screen name="clientes" options={{ title: 'Cliente', ...homeMenu }} />
          <Stack.Screen name="productos" options={{ title: 'Producto', ...homeMenu }} />
          <Stack.Screen name="encabezados" options={{ title: 'Encabezado', ...homeMenu }} />
          <Stack.Screen name="nueva-compra" options={{ title: 'Nueva compra', ...homeMenu }} />
          <Stack.Screen name="detalles" options={{ title: 'Detalle', ...homeMenu }} />
          <Stack.Screen
            name="solicitudes"
            options={{ title: 'Solicitudes pendientes', ...homeMenu }}
          />
          <Stack.Screen
            name="sobre-nosotros"
            options={{ title: 'Sobre nosotros', ...homeMenu }}
          />
          <Stack.Screen
            name="estadisticas"
            options={{ title: 'Estadísticas', ...homeMenu }}
          />
        </Stack>
    </AuthProvider>
  );
}
