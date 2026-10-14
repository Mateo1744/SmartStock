/**
 * RESUMEN DEL ARCHIVO
 * Es el menú principal. Comprueba que la sesión sea válida, obliga al cliente
 * nuevo a completar su perfil y muestra módulos diferentes según el rol.
 */

// Hooks para comprobar acceso y controlar el cierre de sesión.
import { useEffect, useState } from 'react';
// Permite abrir los diferentes módulos de la aplicación.
import { router, type Href } from 'expo-router';
// Conexión compartida para verificar el perfil del cliente.
import { useSQLiteContext } from 'expo-sqlite';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Proporciona usuario, carga y cierre de sesión.
import { useAuth } from '@/context/auth-context';

// El administrador inicial no tiene nombre guardado en Login, por eso se muestra aquí.
const ADMIN_DISPLAY_NAME = 'David Naranjo';

export default function HomeScreen() {
  // Dependencias principales de la pantalla.
  const db = useSQLiteContext();
  const { user, loading, signOut } = useAuth();
  // Estados usados para mostrar indicadores de carga.
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [displayName, setDisplayName] = useState('');

  // Verifica la sesión y el perfil cada vez que cambia el usuario.
  useEffect(() => {
    let isActive = true;

    // Controla que nadie vea el inicio sin una sesión válida.
    async function checkAccess() {
      if (loading) {
        return;
      }

      // Una sesión vacía se redirige al login.
      if (!user) {
        router.replace('/login');
        return;
      }

      // Un cliente debe tener datos personales antes de usar los módulos.
      if (user.rol === 'cliente') {
        const profile = await db.getFirstAsync<{ id: number; nombre: string; apellido: string }>(
          'SELECT id, nombre, apellido FROM Cliente WHERE id_login = ?',
          user.id
        );

        // Si no existe Cliente, abre el formulario obligatorio.
        if (!profile) {
          router.replace('/perfil');
          return;
        }

        // El inicio muestra el nombre personal, no el correo de acceso.
        setDisplayName(`${profile.nombre} ${profile.apellido}`.trim());
      } else {
        setDisplayName(ADMIN_DISPLAY_NAME);
      }

      if (isActive) {
        setCheckingProfile(false);
      }
    }

    checkAccess().catch(() => {
      if (isActive) {
        setCheckingProfile(false);
      }
    });

    return () => {
      isActive = false;
    };
  }, [db, loading, user]);

  // Elimina la sesión local y vuelve al login.
  async function handleSignOut() {
    try {
      setIsSigningOut(true);
      await signOut();
      router.replace('/login');
    } finally {
      setIsSigningOut(false);
    }
  }

  // Evita mostrar el menú antes de terminar las comprobaciones.
  if (loading || checkingProfile || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#176B87" />
      </View>
    );
  }

  // Esta variable simplifica las condiciones visuales por rol.
  const isAdmin = user.rol === 'admin';

  // Cada rol recibe una estructura propia, no solo una lista diferente de botones.
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.shell}>
          {/* Barra común que identifica la aplicación y permite cerrar la sesión. */}
          <View style={styles.topBar}>
            <View style={styles.brandBlock}>
              <View style={[styles.brandMark, isAdmin ? styles.adminBrandMark : styles.clientBrandMark]}>
                <Text style={styles.brandInitials}>SS</Text>
              </View>
              <View>
                <Text style={styles.brandName}>SmartStock</Text>
                <Text style={styles.roleContext}>
                  {isAdmin ? 'Panel administrativo' : 'Área de cliente'}
                </Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.logoutButton, pressed && styles.buttonPressed]}
              onPress={handleSignOut}
              disabled={isSigningOut}>
              {isSigningOut ? (
                <ActivityIndicator color="#176B87" />
              ) : (
                <Text style={styles.logoutText}>Salir</Text>
              )}
            </Pressable>
          </View>

          {isAdmin ? (
            <AdminDashboard displayName={displayName} />
          ) : (
            <ClientDashboard displayName={displayName} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Inicio administrativo: prioriza control, gestión y análisis del negocio.
function AdminDashboard({ displayName }: { displayName: string }) {
  return (
    <>
      <View style={styles.adminHero}>
        <View style={styles.heroTextBlock}>
          <Text style={styles.adminEyebrow}>ACCESO ADMINISTRATIVO</Text>
          <Text style={styles.adminHeroTitle}>Centro de control</Text>
          <Text style={styles.adminHeroDescription}>
            Gestiona usuarios, inventario, compras y resultados desde un solo lugar.
          </Text>
        </View>
        <View style={styles.adminSessionCard}>
          <Text style={styles.sessionLabel}>SESIÓN ACTIVA</Text>
          <Text style={styles.sessionName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.sessionAccess}>Permisos completos</Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.priorityCard, pressed && styles.buttonPressed]}
        onPress={() => router.push('/solicitudes')}>
        <View style={styles.priorityBadge}>
          <Text style={styles.priorityBadgeText}>!</Text>
        </View>
        <View style={styles.priorityTextBlock}>
          <Text style={styles.priorityLabel}>ACCIÓN PRIORITARIA</Text>
          <Text style={styles.priorityTitle}>Revisar solicitudes pendientes</Text>
          <Text style={styles.priorityDescription}>Aprueba o rechaza las cuentas nuevas.</Text>
        </View>
        <Text style={styles.priorityArrow}>›</Text>
      </Pressable>

      <View style={styles.sectionHeading}>
        <Text style={styles.adminSectionTitle}>Gestión del negocio</Text>
        <Text style={styles.sectionSubtitle}>Selecciona el módulo que deseas administrar.</Text>
      </View>

      <View style={styles.dashboardGrid}>
        <DashboardCard
          code="CL"
          title="Clientes"
          description="Consulta y administra las cuentas registradas."
          href="/clientes"
          accentColor="#2F80ED"
          badgeColor="#EAF3FF"
        />
        <DashboardCard
          code="PR"
          title="Productos"
          description="Controla catálogo, precios y existencias."
          href="/productos"
          accentColor="#16835A"
          badgeColor="#E7F7EF"
        />
        <DashboardCard
          code="CO"
          title="Compras"
          description="Revisa encabezados y detalles de compra."
          href="/encabezados"
          accentColor="#7657C8"
          badgeColor="#F0ECFC"
        />
        <DashboardCard
          code="ES"
          title="Estadísticas"
          description="Analiza ingresos, ventas y alertas de stock."
          href="/estadisticas"
          accentColor="#D97706"
          badgeColor="#FFF3DF"
        />
      </View>

      <Pressable
        style={({ pressed }) => [styles.adminAboutCard, pressed && styles.buttonPressed]}
        onPress={() => router.push('/sobre-nosotros')}>
        <View>
          <Text style={styles.adminAboutTitle}>Información de SmartStock</Text>
          <Text style={styles.adminAboutDescription}>Conoce el propósito y alcance del sistema.</Text>
        </View>
        <Text style={styles.adminAboutArrow}>›</Text>
      </Pressable>
    </>
  );
}

// Inicio del cliente: presenta primero las acciones de consulta y compra.
function ClientDashboard({ displayName }: { displayName: string }) {
  return (
    <>
      <View style={styles.clientHero}>
        <View style={styles.clientWelcomeBadge}>
          <Text style={styles.clientWelcomeText}>BIENVENIDO A SMARTSTOCK</Text>
        </View>
        <Text style={styles.clientHeroTitle}>Encuentra lo que necesitas</Text>
        <Text style={styles.clientHeroDescription}>
          Explora productos disponibles, realiza compras y consulta tus movimientos fácilmente.
        </Text>
        <Text style={styles.clientName}>{displayName}</Text>
        <Pressable
          style={({ pressed }) => [styles.primaryClientButton, pressed && styles.buttonPressed]}
          onPress={() => router.push('/productos')}>
          <Text style={styles.primaryClientButtonText}>Explorar productos</Text>
          <Text style={styles.primaryClientButtonArrow}>›</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.clientSectionTitle}>Tu espacio</Text>
        <Text style={styles.sectionSubtitle}>Accede rápidamente a tu información personal.</Text>
      </View>

      <View style={styles.clientActions}>
        <ClientActionCard
          code="MC"
          title="Mis compras"
          description="Crea una compra o revisa las que ya realizaste."
          href="/encabezados"
        />
        <ClientActionCard
          code="MP"
          title="Mi perfil"
          description="Consulta tus datos personales y de contacto."
          href="/clientes"
        />
      </View>

      <Pressable
        style={({ pressed }) => [styles.clientAboutCard, pressed && styles.buttonPressed]}
        onPress={() => router.push('/sobre-nosotros')}>
        <View style={styles.clientAboutBadge}>
          <Text style={styles.clientAboutBadgeText}>i</Text>
        </View>
        <View style={styles.clientAboutText}>
          <Text style={styles.clientAboutTitle}>Conoce SmartStock</Text>
          <Text style={styles.clientAboutDescription}>
            Descubre nuestra historia y cómo facilitamos tus compras.
          </Text>
        </View>
        <Text style={styles.clientAboutArrow}>›</Text>
      </Pressable>
    </>
  );
}

// Tarjeta compacta usada únicamente en el panel administrativo.
function DashboardCard({
  code,
  title,
  description,
  href,
  accentColor,
  badgeColor,
}: {
  code: string;
  title: string;
  description: string;
  href: Href;
  accentColor: string;
  badgeColor: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.dashboardCard,
        { borderTopColor: accentColor },
        pressed && styles.buttonPressed,
      ]}
      onPress={() => router.push(href)}>
      <View style={[styles.dashboardBadge, { backgroundColor: badgeColor }]}>
        <Text style={[styles.dashboardBadgeText, { color: accentColor }]}>{code}</Text>
      </View>
      <Text style={styles.dashboardCardTitle}>{title}</Text>
      <Text style={styles.dashboardCardDescription}>{description}</Text>
      <Text style={[styles.dashboardCardLink, { color: accentColor }]}>Abrir módulo  →</Text>
    </Pressable>
  );
}

// Tarjeta horizontal y sencilla para las acciones personales del cliente.
function ClientActionCard({
  code,
  title,
  description,
  href,
}: {
  code: string;
  title: string;
  description: string;
  href: Href;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.clientActionCard, pressed && styles.buttonPressed]}
      onPress={() => router.push(href)}>
      <View style={styles.clientActionBadge}>
        <Text style={styles.clientActionBadgeText}>{code}</Text>
      </View>
      <View style={styles.clientActionText}>
        <Text style={styles.clientActionTitle}>{title}</Text>
        <Text style={styles.clientActionDescription}>{description}</Text>
      </View>
      <Text style={styles.clientActionArrow}>›</Text>
    </Pressable>
  );
}

// Estilos del menú principal y de las dos experiencias según el rol.
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F6F8' },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 22 },
  shell: { width: '100%', maxWidth: 980, alignSelf: 'center' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7FA',
  },
  topBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 22,
  },
  brandBlock: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandMark: {
    width: 43,
    height: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
  },
  adminBrandMark: { backgroundColor: '#14324A' },
  clientBrandMark: { backgroundColor: '#13795B' },
  brandInitials: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.6 },
  brandName: { color: '#14324A', fontSize: 18, fontWeight: '900' },
  roleContext: { color: '#6B7F8E', fontSize: 12, marginTop: 2 },
  logoutButton: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#AAC1CE',
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  logoutText: { color: '#176B87', fontWeight: '900' },
  adminHero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 24,
    borderRadius: 24,
    padding: 28,
    backgroundColor: '#14324A',
  },
  heroTextBlock: { flex: 2, minWidth: 250 },
  adminEyebrow: { color: '#8ED7E8', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  adminHeroTitle: { color: '#FFFFFF', fontSize: 31, fontWeight: '900', marginTop: 9 },
  adminHeroDescription: { color: '#D9E7EE', fontSize: 15, lineHeight: 23, marginTop: 9 },
  adminSessionCard: {
    flex: 1,
    minWidth: 210,
    borderWidth: 1,
    borderColor: '#36566D',
    borderRadius: 17,
    padding: 17,
    backgroundColor: '#1D4059',
  },
  sessionLabel: { color: '#8ED7E8', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  sessionName: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginTop: 9 },
  sessionAccess: { color: '#B8CFDA', fontSize: 12, marginTop: 5 },
  priorityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    borderWidth: 1,
    borderColor: '#F5CF91',
    borderRadius: 17,
    padding: 18,
    marginTop: 18,
    backgroundColor: '#FFF8EA',
  },
  priorityBadge: {
    width: 43,
    height: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#F59E0B',
  },
  priorityBadgeText: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  priorityTextBlock: { flex: 1 },
  priorityLabel: { color: '#A45C05', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  priorityTitle: { color: '#59390E', fontSize: 17, fontWeight: '900', marginTop: 4 },
  priorityDescription: { color: '#806238', fontSize: 13, marginTop: 3 },
  priorityArrow: { color: '#C8750B', fontSize: 32, lineHeight: 34 },
  sectionHeading: { marginTop: 30, marginBottom: 15 },
  adminSectionTitle: { color: '#14324A', fontSize: 22, fontWeight: '900' },
  clientSectionTitle: { color: '#124E3E', fontSize: 22, fontWeight: '900' },
  sectionSubtitle: { color: '#6A7E8D', fontSize: 14, marginTop: 5 },
  dashboardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  dashboardCard: {
    flexGrow: 1,
    flexBasis: 280,
    minHeight: 190,
    borderWidth: 1,
    borderTopWidth: 4,
    borderColor: '#DFE7EC',
    borderRadius: 17,
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  dashboardBadge: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  dashboardBadgeText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  dashboardCardTitle: { color: '#14324A', fontSize: 18, fontWeight: '900', marginTop: 16 },
  dashboardCardDescription: { flex: 1, color: '#607584', fontSize: 14, lineHeight: 20, marginTop: 7 },
  dashboardCardLink: { fontSize: 13, fontWeight: '900', marginTop: 17 },
  adminAboutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 15,
    padding: 18,
    marginTop: 18,
    backgroundColor: '#E8EEF2',
  },
  adminAboutTitle: { color: '#294A60', fontSize: 15, fontWeight: '900' },
  adminAboutDescription: { color: '#667D8B', fontSize: 13, marginTop: 4 },
  adminAboutArrow: { color: '#496B80', fontSize: 30 },
  clientHero: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#BDE4D6',
    borderRadius: 26,
    padding: 28,
    backgroundColor: '#EAF8F2',
  },
  clientWelcomeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#D1F0E4',
  },
  clientWelcomeText: { color: '#13795B', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  clientHeroTitle: { maxWidth: 600, color: '#124E3E', fontSize: 32, fontWeight: '900', marginTop: 18 },
  clientHeroDescription: { maxWidth: 650, color: '#456E62', fontSize: 16, lineHeight: 24, marginTop: 10 },
  clientName: { color: '#3F7163', fontSize: 15, fontWeight: '900', marginTop: 13 },
  primaryClientButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    borderRadius: 13,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginTop: 22,
    backgroundColor: '#13795B',
  },
  primaryClientButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  primaryClientButtonArrow: { color: '#FFFFFF', fontSize: 23, lineHeight: 23 },
  clientActions: { gap: 12 },
  clientActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    borderWidth: 1,
    borderColor: '#D7E7E1',
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#FFFFFF',
  },
  clientActionBadge: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#E1F4EC',
  },
  clientActionBadgeText: { color: '#13795B', fontSize: 12, fontWeight: '900' },
  clientActionText: { flex: 1 },
  clientActionTitle: { color: '#173F34', fontSize: 17, fontWeight: '900' },
  clientActionDescription: { color: '#647D75', fontSize: 14, lineHeight: 20, marginTop: 4 },
  clientActionArrow: { color: '#2A8B70', fontSize: 31, lineHeight: 32 },
  clientAboutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    padding: 18,
    marginTop: 18,
    backgroundColor: '#FFF7E7',
  },
  clientAboutBadge: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#F6C968',
  },
  clientAboutBadgeText: { color: '#6D4800', fontSize: 20, fontWeight: '900' },
  clientAboutText: { flex: 1 },
  clientAboutTitle: { color: '#604619', fontSize: 16, fontWeight: '900' },
  clientAboutDescription: { color: '#846C42', fontSize: 13, lineHeight: 19, marginTop: 4 },
  clientAboutArrow: { color: '#9A6A0B', fontSize: 30 },
  buttonPressed: { opacity: 0.75 },
});
