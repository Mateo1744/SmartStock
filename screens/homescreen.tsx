/**
 * RESUMEN DEL ARCHIVO
 * Es el menú principal. Comprueba que la sesión sea válida, obliga al cliente
 * nuevo a completar su perfil y muestra módulos diferentes según el rol.
 */

// Hooks para comprobar acceso y controlar el cierre de sesión.
import { useEffect, useState } from 'react';
// Permite abrir los diferentes módulos de la aplicación.
import { router, type Href } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Proporciona usuario, carga y cierre de sesión.
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';

// El administrador inicial no tiene nombre guardado en Login, por eso se muestra aquí.
const ADMIN_DISPLAY_NAME = 'David Naranjo';

const ADMIN_NAV_ITEMS: { code: string; label: string; href: Href }[] = [
  { code: 'CL', label: 'Clientes', href: '/clientes' },
  { code: 'PR', label: 'Productos', href: '/productos' },
  { code: 'CO', label: 'Compras', href: '/encabezados' },
  { code: 'ES', label: 'Estadísticas', href: '/estadisticas' },
];

export default function HomeScreen() {
  // Dependencias principales de la pantalla.
  const { user, loading, signOut } = useAuth();
  const { width, height } = useWindowDimensions();
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
        const { data: profile, error: profileError } = await supabase
          .from('clientes')
          .select('id, nombre, apellido')
          .eq('id_usuario', user.id)
          .maybeSingle();

        if (profileError) throw profileError;

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
  }, [loading, user]);

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
  const showAdminSidebar = width >= 1040;
  const adminCardColumns: 1 | 2 | 4 = width >= 1380 ? 4 : width >= 700 ? 2 : 1;
  const isCompactAdmin = width < 560;

  // Cada rol recibe una estructura propia, no solo una lista diferente de botones.
  return (
    <SafeAreaView style={[styles.safeArea, isAdmin && styles.adminSafeArea]}>
      <ScrollView
        contentContainerStyle={
          isAdmin
            ? [styles.adminPage, isCompactAdmin && styles.adminPageCompact]
            : styles.container
        }>
        {isAdmin ? (
          <AdminDashboard
            displayName={displayName}
            isSigningOut={isSigningOut}
            onSignOut={handleSignOut}
            showSidebar={showAdminSidebar}
            cardColumns={adminCardColumns}
            isCompact={isCompactAdmin}
            viewportHeight={height}
          />
        ) : (
          <View style={styles.shell}>
            <View style={styles.topBar}>
              <BrandBlock role="Área de cliente" />
              <LogoutButton isSigningOut={isSigningOut} onSignOut={handleSignOut} />
            </View>
            <ClientDashboard displayName={displayName} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BrandBlock({ role, inverted = false }: { role: string; inverted?: boolean }) {
  return (
    <View style={styles.brandBlock}>
      <View style={[styles.brandMark, inverted ? styles.brandMarkInverted : styles.clientBrandMark]}>
        <Text style={styles.brandInitials}>SS</Text>
      </View>
      <View>
        <Text style={[styles.brandName, inverted && styles.brandNameInverted]}>SmartStock</Text>
        <Text style={[styles.roleContext, inverted && styles.roleContextInverted]}>{role}</Text>
      </View>
    </View>
  );
}

function LogoutButton({
  isSigningOut,
  onSignOut,
}: {
  isSigningOut: boolean;
  onSignOut: () => void | Promise<void>;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.logoutButton, pressed && styles.buttonPressed]}
      onPress={onSignOut}
      disabled={isSigningOut}>
      {isSigningOut ? (
        <ActivityIndicator color="#126B52" />
      ) : (
        <Text style={styles.logoutText}>Salir</Text>
      )}
    </Pressable>
  );
}

// Inicio administrativo: prioriza control, gestión y análisis del negocio.
function AdminDashboard({
  displayName,
  isSigningOut,
  onSignOut,
  showSidebar,
  cardColumns,
  isCompact,
  viewportHeight,
}: {
  displayName: string;
  isSigningOut: boolean;
  onSignOut: () => void | Promise<void>;
  showSidebar: boolean;
  cardColumns: 1 | 2 | 4;
  isCompact: boolean;
  viewportHeight: number;
}) {
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  return (
    <View
      style={[
        styles.adminWorkspace,
        showSidebar && styles.adminWorkspaceDesktop,
        showSidebar && { minHeight: Math.max(viewportHeight - 44, 720) },
      ]}>
      {showSidebar ? <AdminSidebar /> : null}

      <View style={styles.adminMain}>
        <View style={[styles.adminTopBar, !showSidebar && styles.adminTopBarMobile]}>
          {showSidebar ? (
            <View>
              <Text style={styles.adminTopKicker}>PANEL ADMINISTRATIVO</Text>
              <Text style={styles.adminTopTitle}>Resumen general</Text>
            </View>
          ) : (
            <BrandBlock role="Panel administrativo" />
          )}

          <View style={[styles.adminTopActions, isCompact && styles.adminTopActionsCompact]}>
            <View style={styles.adminSessionSummary}>
              <View style={styles.adminAvatar}>
                <Text style={styles.adminAvatarText}>{initials || 'AD'}</Text>
              </View>
              <View style={styles.adminSessionText}>
                <Text style={styles.adminSessionName} numberOfLines={1}>
                  {displayName}
                </Text>
                <View style={styles.adminSessionStatusRow}>
                  <View style={styles.adminSessionStatusDot} />
                  <Text style={styles.adminSessionStatus}>Sesión activa</Text>
                </View>
              </View>
            </View>
            <LogoutButton isSigningOut={isSigningOut} onSignOut={onSignOut} />
          </View>
        </View>

        {!showSidebar ? <AdminQuickNavigation /> : null}

        <View style={[styles.adminHero, isCompact && styles.adminHeroCompact]}>
        <View style={styles.heroTextBlock}>
          <Text style={styles.adminEyebrow}>ACCESO ADMINISTRATIVO</Text>
          <Text style={styles.adminHeroTitle}>Centro de control</Text>
          <Text style={styles.adminHeroDescription}>
            Gestiona usuarios, inventario, compras y resultados desde un solo lugar.
          </Text>
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
          columns={cardColumns}
        />
        <DashboardCard
          code="PR"
          title="Productos"
          description="Controla catálogo, precios y existencias."
          href="/productos"
          accentColor="#16835A"
          badgeColor="#E7F7EF"
          columns={cardColumns}
        />
        <DashboardCard
          code="CO"
          title="Compras"
          description="Revisa encabezados y detalles de compra."
          href="/encabezados"
          accentColor="#7657C8"
          badgeColor="#F0ECFC"
          columns={cardColumns}
        />
        <DashboardCard
          code="ES"
          title="Estadísticas"
          description="Analiza ingresos, ventas y alertas de stock."
          href="/estadisticas"
          accentColor="#D97706"
          badgeColor="#FFF3DF"
          columns={cardColumns}
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

      <Text style={styles.adminCredit}>Elaborado por David Naranjo</Text>
      </View>
    </View>
  );
}

function AdminSidebar() {
  return (
    <View style={styles.adminSidebar}>
      <BrandBlock role="Panel administrativo" inverted />

      <View style={styles.adminSidebarNavigation}>
        <Text style={styles.adminSidebarLabel}>MENÚ PRINCIPAL</Text>
        <AdminNavItem code="CC" label="Centro de control" href="/home" active />
        {ADMIN_NAV_ITEMS.map((item) => (
          <AdminNavItem key={item.href.toString()} {...item} />
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [styles.adminSidebarAbout, pressed && styles.sidebarPressed]}
        onPress={() => router.push('/sobre-nosotros')}>
        <View style={styles.adminSidebarAboutIcon}>
          <Text style={styles.adminSidebarAboutIconText}>i</Text>
        </View>
        <View style={styles.adminSidebarAboutText}>
          <Text style={styles.adminSidebarAboutTitle}>Sobre SmartStock</Text>
          <Text style={styles.adminSidebarAboutDescription}>Información del sistema</Text>
        </View>
      </Pressable>
    </View>
  );
}

function AdminNavItem({
  code,
  label,
  href,
  active = false,
}: {
  code: string;
  label: string;
  href: Href;
  active?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.adminNavItem,
        active && styles.adminNavItemActive,
        pressed && styles.sidebarPressed,
      ]}
      onPress={() => (active ? router.replace(href) : router.push(href))}>
      <View style={[styles.adminNavCode, active && styles.adminNavCodeActive]}>
        <Text style={[styles.adminNavCodeText, active && styles.adminNavCodeTextActive]}>
          {code}
        </Text>
      </View>
      <Text style={[styles.adminNavLabel, active && styles.adminNavLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function AdminQuickNavigation() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.adminQuickNavigationScroller}
      contentContainerStyle={styles.adminQuickNavigation}>
      {ADMIN_NAV_ITEMS.map((item) => (
        <Pressable
          key={item.href.toString()}
          style={({ pressed }) => [styles.adminQuickItem, pressed && styles.buttonPressed]}
          onPress={() => router.push(item.href)}>
          <Text style={styles.adminQuickCode}>{item.code}</Text>
          <Text style={styles.adminQuickLabel}>{item.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
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
  columns,
}: {
  code: string;
  title: string;
  description: string;
  href: Href;
  accentColor: string;
  badgeColor: string;
  columns: 1 | 2 | 4;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.dashboardCard,
        columns === 4
          ? styles.dashboardCardFourColumns
          : columns === 2
            ? styles.dashboardCardTwoColumns
            : styles.dashboardCardOneColumn,
        pressed && styles.buttonPressed,
      ]}
      onPress={() => router.push(href)}>
      <View style={[styles.dashboardBadge, { backgroundColor: badgeColor }]}>
        <Text style={[styles.dashboardBadgeText, { color: accentColor }]}>{code}</Text>
      </View>
      <Text style={styles.dashboardCardTitle}>{title}</Text>
      <Text style={styles.dashboardCardDescription}>{description}</Text>
      <View style={styles.dashboardCardFooter}>
        <Text style={[styles.dashboardCardLink, { color: accentColor }]}>Abrir módulo</Text>
        <View style={[styles.dashboardArrowButton, { backgroundColor: badgeColor }]}>
          <Text style={[styles.dashboardArrow, { color: accentColor }]}>›</Text>
        </View>
      </View>
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
  adminSafeArea: { backgroundColor: '#F4F7F5' },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 22 },
  shell: { width: '100%', maxWidth: 980, alignSelf: 'center' },
  adminPage: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 1540,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 22,
  },
  adminPageCompact: { paddingHorizontal: 14, paddingVertical: 14 },
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
  clientBrandMark: { backgroundColor: '#13795B' },
  brandMarkInverted: { backgroundColor: '#16866A' },
  brandInitials: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.6 },
  brandName: { color: '#14324A', fontSize: 18, fontWeight: '900' },
  brandNameInverted: { color: '#FFFFFF' },
  roleContext: { color: '#6B7F8E', fontSize: 12, marginTop: 2 },
  roleContextInverted: { color: '#B9D8CF' },
  logoutButton: {
    minHeight: 46,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#91BEAF',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  logoutText: { color: '#126B52', fontWeight: '900' },
  adminWorkspace: { width: '100%' },
  adminWorkspaceDesktop: { flexDirection: 'row', alignItems: 'stretch', gap: 24 },
  adminSidebar: {
    width: 248,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#0B4338',
  },
  adminSidebarNavigation: { flex: 1, marginTop: 38, gap: 8 },
  adminSidebarLabel: {
    color: '#88B8AA',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 6,
    paddingHorizontal: 10,
  },
  adminNavItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 10,
  },
  adminNavItemActive: { backgroundColor: '#19594D' },
  adminNavCode: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#174F44',
  },
  adminNavCodeActive: { backgroundColor: '#D7F2E7' },
  adminNavCodeText: { color: '#A5CFC3', fontSize: 10, fontWeight: '900' },
  adminNavCodeTextActive: { color: '#0B6A51' },
  adminNavLabel: { color: '#CBE1DB', fontSize: 14, fontWeight: '700' },
  adminNavLabelActive: { color: '#FFFFFF', fontWeight: '900' },
  sidebarPressed: { opacity: 0.72 },
  adminSidebarAbout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: '#2A655A',
    borderRadius: 16,
    padding: 13,
    marginTop: 26,
    backgroundColor: '#124C41',
  },
  adminSidebarAboutIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#D7F2E7',
  },
  adminSidebarAboutIconText: { color: '#0B6A51', fontSize: 17, fontWeight: '900' },
  adminSidebarAboutText: { flex: 1 },
  adminSidebarAboutTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  adminSidebarAboutDescription: { color: '#A9CEC4', fontSize: 10, marginTop: 3 },
  adminMain: { flex: 1, minWidth: 0 },
  adminTopBar: {
    minHeight: 70,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderWidth: 1,
    borderColor: '#DFE8E4',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  adminTopBarMobile: { marginBottom: 12 },
  adminTopKicker: { color: '#71847D', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  adminTopTitle: { color: '#173B32', fontSize: 17, fontWeight: '900', marginTop: 4 },
  adminTopActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  adminTopActionsCompact: { width: '100%', justifyContent: 'space-between' },
  adminSessionSummary: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  adminAvatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#E2F3ED',
  },
  adminAvatarText: { color: '#126B52', fontSize: 12, fontWeight: '900' },
  adminSessionText: { minWidth: 0 },
  adminSessionName: { maxWidth: 170, color: '#173B32', fontSize: 14, fontWeight: '900' },
  adminSessionStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  adminSessionStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#29A777' },
  adminSessionStatus: { color: '#6A7E77', fontSize: 11 },
  adminQuickNavigationScroller: { marginHorizontal: -2, marginBottom: 6 },
  adminQuickNavigation: { gap: 8, paddingHorizontal: 2, paddingVertical: 4 },
  adminQuickItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D9E6E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  adminQuickCode: { color: '#16835A', fontSize: 10, fontWeight: '900' },
  adminQuickLabel: { color: '#35574D', fontSize: 12, fontWeight: '800' },
  adminHero: {
    paddingHorizontal: 4,
    paddingTop: 38,
    paddingBottom: 24,
  },
  adminHeroCompact: { paddingTop: 24, paddingBottom: 18 },
  heroTextBlock: { maxWidth: 760 },
  adminEyebrow: { color: '#4C8272', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  adminHeroTitle: { color: '#102F27', fontSize: 36, fontWeight: '900', marginTop: 9 },
  adminHeroDescription: { color: '#657871', fontSize: 15, lineHeight: 23, marginTop: 9 },
  priorityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    borderWidth: 1,
    borderColor: '#F5CF91',
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#FFF9EE',
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
  adminSectionTitle: { color: '#173B32', fontSize: 22, fontWeight: '900' },
  clientSectionTitle: { color: '#124E3E', fontSize: 22, fontWeight: '900' },
  sectionSubtitle: { color: '#6A7E77', fontSize: 14, marginTop: 5 },
  dashboardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  dashboardCard: {
    flexGrow: 1,
    minWidth: 0,
    minHeight: 210,
    borderWidth: 1,
    borderColor: '#DCE7E2',
    borderRadius: 18,
    padding: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#183D33',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  dashboardCardFourColumns: { flexBasis: '22%' },
  dashboardCardTwoColumns: { flexBasis: '46%' },
  dashboardCardOneColumn: { flexBasis: '100%', minHeight: 184 },
  dashboardBadge: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  dashboardBadgeText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  dashboardCardTitle: { color: '#173B32', fontSize: 18, fontWeight: '900', marginTop: 16 },
  dashboardCardDescription: { flex: 1, color: '#64766F', fontSize: 14, lineHeight: 20, marginTop: 7 },
  dashboardCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 17,
  },
  dashboardCardLink: { fontSize: 13, fontWeight: '900' },
  dashboardArrowButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  dashboardArrow: { fontSize: 24, lineHeight: 25, fontWeight: '700' },
  adminAboutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D8E5DF',
    borderRadius: 16,
    padding: 18,
    marginTop: 18,
    backgroundColor: '#EAF4F0',
  },
  adminAboutTitle: { color: '#204B3F', fontSize: 15, fontWeight: '900' },
  adminAboutDescription: { color: '#657B73', fontSize: 13, marginTop: 4 },
  adminAboutArrow: { color: '#32725F', fontSize: 30 },
  adminCredit: {
    alignSelf: 'flex-end',
    color: '#71847D',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 18,
    paddingRight: 2,
    textAlign: 'right',
  },
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
