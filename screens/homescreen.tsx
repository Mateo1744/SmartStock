/**
 * RESUMEN DEL ARCHIVO
 * Es el menú principal. Comprueba que la sesión sea válida, obliga al cliente
 * nuevo a completar su perfil y muestra módulos diferentes según el rol.
 */

// Hooks para comprobar acceso y controlar el cierre de sesión.
import { useCallback, useEffect, useMemo, useState } from 'react';
// Permite abrir los diferentes módulos de la aplicación.
import { router, type Href, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

type ClientProduct = {
  id: number;
  nombre: string;
  descripcion: string;
  valor_unitario: number;
  stock: number;
};

type ClientPurchase = {
  id: number;
  fecha: string;
  total: number;
};

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

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
        <ActivityIndicator size="large" color="#13795B" />
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
            <ClientDashboard
              displayName={displayName}
              isSigningOut={isSigningOut}
              onSignOut={handleSignOut}
            />
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
          accentColor="#13795B"
          badgeColor="#EAF8F2"
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
          accentColor="#126B52"
          badgeColor="#EAF8F2"
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

// Inicio del cliente: combina resumen, accesos y productos con información real de Supabase.
function ClientDashboard({
  displayName,
  isSigningOut,
  onSignOut,
}: {
  displayName: string;
  isSigningOut: boolean;
  onSignOut: () => void | Promise<void>;
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 680;
  const isWide = width >= 1060;
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<ClientProduct[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [latestPurchase, setLatestPurchase] = useState<ClientPurchase | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const loadClientSummary = useCallback(async () => {
    setIsLoadingSummary(true);
    setSummaryError(null);

    try {
      const [productsResult, productCountResult, purchaseCountResult, latestPurchaseResult] =
        await Promise.all([
          supabase
            .from('productos')
            .select('id, nombre, descripcion, valor_unitario, stock')
            .gt('stock', 0)
            .order('stock', { ascending: false })
            .limit(8),
          supabase.from('productos').select('id', { count: 'exact', head: true }).gt('stock', 0),
          supabase.from('encabezados').select('id', { count: 'exact', head: true }),
          supabase
            .from('encabezados')
            .select('id, fecha, total')
            .order('fecha', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      const firstError =
        productsResult.error ??
        productCountResult.error ??
        purchaseCountResult.error ??
        latestPurchaseResult.error;
      if (firstError) throw firstError;

      setProducts(
        (productsResult.data ?? []).map((product) => ({
          ...product,
          valor_unitario: Number(product.valor_unitario),
          stock: Number(product.stock),
        })),
      );
      setProductCount(productCountResult.count ?? 0);
      setPurchaseCount(purchaseCountResult.count ?? 0);
      setLatestPurchase(
        latestPurchaseResult.data
          ? {
              ...latestPurchaseResult.data,
              total: Number(latestPurchaseResult.data.total),
            }
          : null,
      );
    } catch {
      setSummaryError('No pudimos actualizar el resumen. Puedes seguir usando los módulos.');
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadClientSummary();
    }, [loadClientSummary]),
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    const matches = query
      ? products.filter((product) =>
          `${product.nombre} ${product.descripcion}`.toLocaleLowerCase('es').includes(query),
        )
      : products;
    return matches.slice(0, 3);
  }, [products, search]);

  const firstName = displayName.split(' ')[0] || displayName;
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Buenos días' : currentHour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const searchBox = (
    <View style={[styles.clientSearch, isMobile && styles.clientSearchMobile]}>
      <Text style={styles.clientSearchIcon}>⌕</Text>
      <TextInput
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => router.push('/productos')}
        placeholder="Buscar productos..."
        placeholderTextColor="#799087"
        returnKeyType="search"
        style={styles.clientSearchInput}
      />
    </View>
  );
  const accountBlock = (
    <View style={[styles.clientAccount, isMobile && styles.clientAccountMobile]}>
      <View style={styles.clientAvatar}>
        <Text style={styles.clientAvatarText}>{initials || 'CL'}</Text>
      </View>
      {!isMobile && (
        <View style={styles.clientIdentity}>
          <Text numberOfLines={1} style={styles.clientIdentityName}>{displayName}</Text>
          <Text style={styles.clientIdentityRole}>Cliente</Text>
        </View>
      )}
      <LogoutButton isSigningOut={isSigningOut} onSignOut={onSignOut} />
    </View>
  );

  return (
    <>
      <View style={[styles.clientTopBar, isMobile && styles.clientTopBarMobile]}>
        <BrandBlock role="Área de cliente" />
        {isMobile ? accountBlock : searchBox}
        {isMobile ? searchBox : accountBlock}
      </View>

      {summaryError && <Text style={styles.clientSummaryError}>{summaryError}</Text>}

      <View style={[styles.clientBentoTop, !isWide && styles.clientBentoTopStacked]}>
        <View style={styles.clientHero}>
          <View style={styles.clientHeroGlow} />
          <View style={[styles.clientHeroContent, isMobile && styles.clientHeroContentMobile]}>
            <View style={styles.clientWelcomeBadge}>
              <Text style={styles.clientWelcomeText}>TU ESPACIO SMARTSTOCK</Text>
            </View>
            <Text style={styles.clientGreeting}>{greeting}, {firstName}</Text>
            <Text style={styles.clientHeroTitle}>Todo lo que necesitas, siempre disponible</Text>
            <Text style={styles.clientHeroDescription}>
              Explora el catálogo, compra con facilidad y consulta todos tus movimientos.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.primaryClientButton, pressed && styles.buttonPressed]}
              onPress={() => router.push('/productos')}>
              <Text style={styles.primaryClientButtonText}>Explorar productos</Text>
              <Text style={styles.primaryClientButtonArrow}>›</Text>
            </Pressable>
          </View>
          {!isMobile && (
            <View style={styles.clientHeroIllustration}>
              <View style={styles.clientPackageBack} />
              <View style={styles.clientPackageFront}>
                <Text style={styles.clientPackageLogo}>SS</Text>
                <View style={styles.clientPackageLine} />
                <View style={styles.clientPackageLineShort} />
              </View>
              <View style={styles.clientHeroSparkOne} />
              <View style={styles.clientHeroSparkTwo} />
            </View>
          )}
        </View>

        <View style={[styles.clientSideGrid, isMobile && styles.clientSideGridMobile]}>
          <ClientMetricCard
            code="PD"
            label="Productos disponibles"
            value={isLoadingSummary ? '—' : String(productCount)}
            description="Listos para comprar"
          />
          <ClientMetricCard
            code="CR"
            label="Compras realizadas"
            value={isLoadingSummary ? '—' : String(purchaseCount)}
            description="Consulta tu historial"
            onPress={() => router.push('/encabezados')}
          />
          <Pressable
            style={({ pressed }) => [styles.clientNewPurchaseCard, pressed && styles.buttonPressed]}
            onPress={() => router.push('/nueva-compra')}>
            <View style={styles.clientNewPurchaseIcon}><Text style={styles.clientNewPurchaseIconText}>＋</Text></View>
            <Text style={styles.clientNewPurchaseTitle}>Nueva compra</Text>
            <Text style={styles.clientNewPurchaseDescription}>Agrega productos y crea un pedido.</Text>
            <Text style={styles.clientNewPurchaseLink}>Comenzar ahora  ›</Text>
          </Pressable>
          <Pressable
            disabled={!latestPurchase}
            style={({ pressed }) => [styles.clientLatestCard, pressed && styles.buttonPressed]}
            onPress={() => latestPurchase && router.push({ pathname: '/detalles', params: { id: String(latestPurchase.id) } })}>
            <View style={styles.clientLatestHeader}>
              <Text style={styles.clientLatestEyebrow}>ÚLTIMA COMPRA</Text>
              <Text style={styles.clientLatestArrow}>↗</Text>
            </View>
            {latestPurchase ? (
              <>
                <Text style={styles.clientLatestTitle}>Compra #{String(latestPurchase.id).padStart(3, '0')}</Text>
                <Text style={styles.clientLatestTotal}>{moneyFormatter.format(latestPurchase.total)}</Text>
                <Text style={styles.clientLatestDate}>{dateFormatter.format(new Date(latestPurchase.fecha))}</Text>
              </>
            ) : (
              <>
                <Text style={styles.clientLatestTitle}>Aún no tienes compras</Text>
                <Text style={styles.clientLatestEmpty}>Tu primer pedido aparecerá aquí.</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      <View style={[styles.clientBottomGrid, !isWide && styles.clientBottomGridStacked]}>
        <View style={styles.clientProductsPanel}>
          <View style={styles.clientSectionHeader}>
            <View>
              <Text style={styles.clientRecommendedTitle}>Recomendados para ti</Text>
              <Text style={styles.clientSectionDescription}>Productos disponibles en este momento.</Text>
            </View>
            <Pressable onPress={() => router.push('/productos')}>
              <Text style={styles.clientSeeAll}>Ver todos  ›</Text>
            </Pressable>
          </View>

          {isLoadingSummary ? (
            <View style={styles.clientProductsLoading}>
              <ActivityIndicator color="#13795B" />
              <Text style={styles.clientProductsLoadingText}>Cargando productos...</Text>
            </View>
          ) : filteredProducts.length > 0 ? (
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.clientProductRow}>
              {filteredProducts.map((product, index) => (
                <ClientProductCard key={product.id} product={product} index={index} />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.clientProductsEmpty}>
              <Text style={styles.clientProductsEmptyTitle}>No encontramos productos</Text>
              <Text style={styles.clientProductsEmptyText}>Prueba con otro término o revisa el catálogo completo.</Text>
            </View>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.clientAboutCard,
            !isWide && styles.clientAboutCardStacked,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.push('/sobre-nosotros')}>
          <View style={styles.clientAboutBadge}><Text style={styles.clientAboutBadgeText}>i</Text></View>
          <Text style={styles.clientAboutEyebrow}>CONOCE SMARTSTOCK</Text>
          <Text style={styles.clientAboutTitle}>Compras simples, decisiones inteligentes.</Text>
          <Text style={styles.clientAboutDescription}>
            Descubre cómo facilitamos cada compra y mantenemos tu información organizada.
          </Text>
          <Text style={styles.clientAboutLink}>Nuestra historia  ›</Text>
          <View style={styles.clientAboutDecorationOne} />
          <View style={styles.clientAboutDecorationTwo} />
        </Pressable>
      </View>
    </>
  );
}

function ClientMetricCard({
  code,
  label,
  value,
  description,
  onPress,
}: {
  code: string;
  label: string;
  value: string;
  description: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={!onPress}
      style={({ pressed }) => [styles.clientMetricCard, pressed && styles.buttonPressed]}
      onPress={onPress}>
      <View style={styles.clientMetricTop}>
        <View style={styles.clientMetricIcon}><Text style={styles.clientMetricIconText}>{code}</Text></View>
        <Text style={styles.clientMetricArrow}>↗</Text>
      </View>
      <Text style={styles.clientMetricValue}>{value}</Text>
      <Text style={styles.clientMetricLabel}>{label}</Text>
      <Text style={styles.clientMetricDescription}>{description}</Text>
    </Pressable>
  );
}

function ClientProductCard({ product, index }: { product: ClientProduct; index: number }) {
  const tones = [styles.clientProductVisualMint, styles.clientProductVisualCream, styles.clientProductVisualSage];
  const initials = product.nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <Pressable
      style={({ pressed }) => [styles.clientProductCard, pressed && styles.buttonPressed]}
      onPress={() => router.push('/nueva-compra')}>
      <View style={[styles.clientProductVisual, tones[index % tones.length]]}>
        <View style={styles.clientProductBox}>
          <Text style={styles.clientProductBoxText}>{initials || 'SS'}</Text>
        </View>
        <View style={styles.clientStockBadge}><Text style={styles.clientStockBadgeText}>EN STOCK</Text></View>
      </View>
      <Text numberOfLines={1} style={styles.clientProductName}>{product.nombre}</Text>
      <Text numberOfLines={2} style={styles.clientProductDescription}>{product.descripcion || 'Producto disponible'}</Text>
      <View style={styles.clientProductFooter}>
        <Text style={styles.clientProductPrice}>{moneyFormatter.format(product.valor_unitario)}</Text>
        <View style={styles.clientProductAdd}><Text style={styles.clientProductAddText}>＋</Text></View>
      </View>
    </Pressable>
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

// Estilos del menú principal y de las dos experiencias según el rol.
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7F5' },
  adminSafeArea: { backgroundColor: '#F4F7F5' },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 22 },
  shell: { width: '100%', maxWidth: 1380, alignSelf: 'center' },
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
    backgroundColor: '#F4F7F5',
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
  brandName: { color: '#173B32', fontSize: 18, fontWeight: '900' },
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
  clientTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    marginBottom: 22,
  },
  clientTopBarMobile: { flexWrap: 'wrap', gap: 12 },
  clientSearch: {
    flex: 1,
    maxWidth: 540,
    minWidth: 240,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: '#D6E4DE',
    borderRadius: 14,
    paddingHorizontal: 15,
    backgroundColor: '#FFFFFF',
  },
  clientSearchMobile: { flexBasis: '100%', width: '100%', maxWidth: '100%' },
  clientSearchIcon: { color: '#477065', fontSize: 23, lineHeight: 24 },
  clientSearchInput: { flex: 1, minHeight: 44, color: '#173B32', fontSize: 14 },
  clientAccount: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clientAccountMobile: { marginLeft: 'auto' },
  clientAvatar: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#DDF2E9',
  },
  clientAvatarText: { color: '#13795B', fontSize: 12, fontWeight: '900' },
  clientIdentity: { maxWidth: 145 },
  clientIdentityName: { color: '#173B32', fontSize: 13, fontWeight: '900' },
  clientIdentityRole: { color: '#71867F', fontSize: 11, marginTop: 2 },
  clientSummaryError: {
    borderWidth: 1,
    borderColor: '#E7CFA0',
    borderRadius: 12,
    color: '#785616',
    fontSize: 13,
    padding: 12,
    marginBottom: 14,
    backgroundColor: '#FFF7E7',
  },
  clientBentoTop: { flexDirection: 'row', alignItems: 'stretch', gap: 16 },
  clientBentoTopStacked: { flexDirection: 'column' },
  clientHero: {
    flex: 1.55,
    minHeight: 326,
    overflow: 'hidden',
    borderRadius: 28,
    padding: 30,
    backgroundColor: '#0B4338',
  },
  clientHeroGlow: {
    position: 'absolute',
    width: 330,
    height: 330,
    right: -80,
    top: -115,
    borderRadius: 165,
    backgroundColor: '#176A57',
    opacity: 0.58,
  },
  clientHeroContent: { zIndex: 2, width: '65%', minWidth: 270 },
  clientHeroContentMobile: { width: '100%', minWidth: 0 },
  clientWelcomeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#1D6D5B',
  },
  clientWelcomeText: { color: '#BFE8D9', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  clientGreeting: { color: '#CBE8DF', fontSize: 15, fontWeight: '800', marginTop: 22 },
  clientHeroTitle: { maxWidth: 520, color: '#FFFFFF', fontSize: 32, lineHeight: 39, fontWeight: '900', marginTop: 8 },
  clientHeroDescription: { maxWidth: 500, color: '#C0DAD2', fontSize: 14, lineHeight: 21, marginTop: 10 },
  primaryClientButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    borderRadius: 13,
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginTop: 22,
    backgroundColor: '#FFFFFF',
  },
  primaryClientButtonText: { color: '#0B4338', fontSize: 14, fontWeight: '900' },
  primaryClientButtonArrow: { color: '#13795B', fontSize: 23, lineHeight: 23 },
  clientHeroIllustration: {
    position: 'absolute',
    width: 210,
    height: 230,
    right: 27,
    bottom: 16,
  },
  clientPackageBack: {
    position: 'absolute',
    width: 120,
    height: 142,
    right: 9,
    top: 22,
    borderRadius: 16,
    backgroundColor: '#2D806C',
    transform: [{ rotate: '10deg' }],
  },
  clientPackageFront: {
    position: 'absolute',
    width: 132,
    height: 158,
    right: 43,
    top: 48,
    borderRadius: 17,
    padding: 20,
    backgroundColor: '#EAF8F2',
    transform: [{ rotate: '-7deg' }],
  },
  clientPackageLogo: { color: '#13795B', fontSize: 24, fontWeight: '900' },
  clientPackageLine: { width: 67, height: 8, borderRadius: 4, marginTop: 42, backgroundColor: '#8DC8B7' },
  clientPackageLineShort: { width: 46, height: 8, borderRadius: 4, marginTop: 10, backgroundColor: '#BEDFD5' },
  clientHeroSparkOne: { position: 'absolute', width: 12, height: 12, left: 8, top: 32, borderRadius: 6, backgroundColor: '#F4C765' },
  clientHeroSparkTwo: { position: 'absolute', width: 8, height: 8, right: 4, bottom: 16, borderRadius: 4, backgroundColor: '#A9DCCA' },
  clientSideGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  clientSideGridMobile: { gap: 10 },
  clientMetricCard: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 145,
    minHeight: 157,
    borderWidth: 1,
    borderColor: '#D8E6E0',
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  clientMetricTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clientMetricIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#E3F4ED' },
  clientMetricIconText: { color: '#13795B', fontSize: 9, fontWeight: '900' },
  clientMetricArrow: { color: '#7B938B', fontSize: 16 },
  clientMetricValue: { color: '#133F34', fontSize: 29, fontWeight: '900', marginTop: 12 },
  clientMetricLabel: { color: '#234C41', fontSize: 12, fontWeight: '900', marginTop: 2 },
  clientMetricDescription: { color: '#7B8E88', fontSize: 10, marginTop: 5 },
  clientNewPurchaseCard: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 145,
    minHeight: 157,
    overflow: 'hidden',
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#13795B',
  },
  clientNewPurchaseIcon: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#2A8A70' },
  clientNewPurchaseIconText: { color: '#FFFFFF', fontSize: 21, fontWeight: '700' },
  clientNewPurchaseTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginTop: 12 },
  clientNewPurchaseDescription: { color: '#D1EAE2', fontSize: 10, lineHeight: 14, marginTop: 4 },
  clientNewPurchaseLink: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', marginTop: 10 },
  clientLatestCard: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 145,
    minHeight: 157,
    borderWidth: 1,
    borderColor: '#EBDDBB',
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#FFF8E9',
  },
  clientLatestHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clientLatestEyebrow: { color: '#8C6722', fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  clientLatestArrow: { color: '#A57B29', fontSize: 16 },
  clientLatestTitle: { color: '#57441E', fontSize: 13, fontWeight: '900', marginTop: 14 },
  clientLatestTotal: { color: '#5E481A', fontSize: 20, fontWeight: '900', marginTop: 5 },
  clientLatestDate: { color: '#8E7A51', fontSize: 10, marginTop: 5 },
  clientLatestEmpty: { color: '#8E7A51', fontSize: 10, lineHeight: 15, marginTop: 9 },
  clientBottomGrid: { flexDirection: 'row', alignItems: 'stretch', gap: 16, marginTop: 16 },
  clientBottomGridStacked: { flexDirection: 'column' },
  clientProductsPanel: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#D9E6E1',
    borderRadius: 24,
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  clientSectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 17 },
  clientRecommendedTitle: { color: '#173F34', fontSize: 20, fontWeight: '900' },
  clientSectionDescription: { color: '#748881', fontSize: 12, marginTop: 4 },
  clientSeeAll: { color: '#13795B', fontSize: 12, fontWeight: '900', paddingVertical: 4 },
  clientProductsLoading: { minHeight: 230, alignItems: 'center', justifyContent: 'center', gap: 10 },
  clientProductsLoadingText: { color: '#71867F', fontSize: 12 },
  clientProductRow: { gap: 12, paddingRight: 2 },
  clientProductCard: {
    width: 224,
    borderWidth: 1,
    borderColor: '#E0E9E5',
    borderRadius: 17,
    padding: 11,
    backgroundColor: '#FFFFFF',
  },
  clientProductVisual: { height: 116, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  clientProductVisualMint: { backgroundColor: '#E8F5EF' },
  clientProductVisualCream: { backgroundColor: '#FFF4DA' },
  clientProductVisualSage: { backgroundColor: '#E5EFE9' },
  clientProductBox: { width: 68, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFFFFF', shadowColor: '#214F42', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },
  clientProductBoxText: { color: '#13795B', fontSize: 17, fontWeight: '900' },
  clientStockBadge: { position: 'absolute', top: 9, left: 9, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: '#D7EFE6' },
  clientStockBadgeText: { color: '#13795B', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  clientProductName: { color: '#193F35', fontSize: 14, fontWeight: '900', marginTop: 12 },
  clientProductDescription: { minHeight: 31, color: '#74867F', fontSize: 10, lineHeight: 15, marginTop: 4 },
  clientProductFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 9 },
  clientProductPrice: { flex: 1, color: '#13795B', fontSize: 14, fontWeight: '900' },
  clientProductAdd: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#13795B' },
  clientProductAddText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  clientProductsEmpty: { minHeight: 230, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  clientProductsEmptyTitle: { color: '#214B40', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  clientProductsEmptyText: { color: '#768A83', fontSize: 12, lineHeight: 18, marginTop: 5, textAlign: 'center' },
  clientAboutCard: {
    width: 310,
    minHeight: 304,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEDDB4',
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#FFF7E7',
  },
  clientAboutCardStacked: { width: '100%', minHeight: 260 },
  clientAboutBadge: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#F6C968' },
  clientAboutBadgeText: { color: '#6D4800', fontSize: 20, fontWeight: '900' },
  clientAboutEyebrow: { color: '#987019', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 26 },
  clientAboutTitle: { maxWidth: 235, color: '#554018', fontSize: 21, lineHeight: 27, fontWeight: '900', marginTop: 10 },
  clientAboutDescription: { maxWidth: 235, color: '#826D44', fontSize: 12, lineHeight: 18, marginTop: 10 },
  clientAboutLink: { color: '#8B620D', fontSize: 12, fontWeight: '900', marginTop: 18 },
  clientAboutDecorationOne: { position: 'absolute', width: 110, height: 110, right: -35, bottom: -40, borderRadius: 55, backgroundColor: '#F6D88F', opacity: 0.55 },
  clientAboutDecorationTwo: { position: 'absolute', width: 56, height: 56, right: 32, bottom: 22, borderRadius: 28, backgroundColor: '#EDBE55', opacity: 0.34 },
  buttonPressed: { opacity: 0.75 },
});
