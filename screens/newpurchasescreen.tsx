/**
 * Permite seleccionar productos, revisar el pedido y registrar la compra.
 * La composición cambia entre catálogo con resumen lateral en web y barra
 * inferior con revisión modal en dispositivos móviles.
 */
import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { createPurchase } from '@/database/purchases';
import { supabase } from '@/lib/supabase';

type Product = {
  id: number;
  nombre: string;
  descripcion: string;
  valor_unitario: number;
  stock: number;
};

type SelectedItem = { product: Product; quantity: number };
type ProductFilter = 'todos' | 'disponibles' | 'poco-stock';

const FILTERS: { key: ProductFilter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'disponibles', label: 'Disponibles' },
  { key: 'poco-stock', label: 'Poco stock' },
];

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function NewPurchaseScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 980;
  const isCompact = width < 560;
  const { user, loading: authLoading } = useAuth();
  const [clientId, setClientId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ProductFilter>('todos');
  const [reviewVisible, setReviewVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;

    async function loadData() {
      if (authLoading) return;
      if (!user) {
        router.replace('/login');
        return;
      }
      if (user.rol !== 'cliente') {
        router.replace('/encabezados');
        return;
      }

      try {
        const { data: client, error: clientError } = await supabase
          .from('clientes')
          .select('id')
          .eq('id_usuario', user.id)
          .maybeSingle();
        if (clientError) throw clientError;
        if (!client) {
          router.replace('/perfil');
          return;
        }

        const { data: rows, error: productsError } = await supabase
          .from('productos')
          .select('id, nombre, descripcion, valor_unitario, stock')
          .gt('stock', 0)
          .order('nombre', { ascending: true });
        if (productsError) throw productsError;

        if (isActive) {
          setClientId(client.id);
          setProducts(
            (rows ?? []).map((product) => ({
              ...product,
              valor_unitario: Number(product.valor_unitario),
              stock: Number(product.stock),
            })),
          );
        }
      } catch {
        if (isActive) setError('No fue posible cargar los productos disponibles.');
      } finally {
        if (isActive) setLoading(false);
      }
    }

    void loadData();
    return () => {
      isActive = false;
    };
  }, [authLoading, user]);

  const selectedItems = useMemo<SelectedItem[]>(
    () =>
      products
        .map((product) => ({ product, quantity: quantities[product.id] ?? 0 }))
        .filter((item) => item.quantity > 0),
    [products, quantities],
  );

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return products.filter((product) => {
      const matchesSearch =
        !query ||
        `${product.nombre} ${product.descripcion}`.toLocaleLowerCase('es').includes(query);
      const matchesFilter =
        filter === 'todos' ||
        (filter === 'disponibles' && product.stock > 5) ||
        (filter === 'poco-stock' && product.stock <= 5);
      return matchesSearch && matchesFilter;
    });
  }, [filter, products, search]);

  const totalUnits = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.quantity, 0),
    [selectedItems],
  );
  const total = useMemo(
    () =>
      selectedItems.reduce(
        (sum, item) => sum + item.product.valor_unitario * item.quantity,
        0,
      ),
    [selectedItems],
  );

  function changeQuantity(product: Product, difference: number) {
    setError('');
    setQuantities((current) => {
      const nextValue = Math.min(
        product.stock,
        Math.max(0, (current[product.id] ?? 0) + difference),
      );
      return { ...current, [product.id]: nextValue };
    });
  }

  async function handlePurchase() {
    setError('');
    if (!clientId) {
      setError('No se encontró el perfil del cliente.');
      return;
    }
    if (selectedItems.length === 0) {
      setError('Selecciona al menos un producto para continuar.');
      return;
    }

    const invalidQuantity = selectedItems.find((item) => item.quantity > item.product.stock);
    if (invalidQuantity) {
      setError(`La cantidad de ${invalidQuantity.product.nombre} supera el stock disponible.`);
      return;
    }

    try {
      setSaving(true);
      setReviewVisible(false);
      const purchaseId = await createPurchase(
        clientId,
        selectedItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      );
      router.replace({ pathname: '/detalles', params: { id: String(purchaseId) } });
    } catch (purchaseError) {
      setError(
        purchaseError instanceof Error
          ? purchaseError.message
          : 'No fue posible registrar la compra.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading || !user || user.rol !== 'cliente') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#13795B" />
        <Text style={styles.loadingText}>Preparando el catálogo...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          isDesktop ? styles.containerDesktop : styles.containerMobile,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={[styles.mainLayout, !isDesktop && styles.mainLayoutMobile]}>
          <View style={styles.catalogColumn}>
            <View style={[styles.heroCard, isCompact && styles.heroCardCompact]}>
              <View style={styles.heroContent}>
                <Text style={styles.heroEyebrow}>NUEVA COMPRA</Text>
                <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>
                  Arma tu compra en pocos pasos
                </Text>
                <Text style={styles.heroText}>Selecciona productos y ajusta las cantidades.</Text>
              </View>
              {!isCompact ? <ShoppingBagIllustration /> : null}
            </View>

            <View style={[styles.toolsRow, !isDesktop && styles.toolsRowMobile]}>
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>⌕</Text>
                <TextInput
                  accessibilityLabel="Buscar productos"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar productos"
                  placeholderTextColor="#71847D"
                  returnKeyType="search"
                  style={styles.searchInput}
                />
              </View>

              <ScrollView
                horizontal
                contentContainerStyle={styles.filters}
                showsHorizontalScrollIndicator={false}>
                {FILTERS.map((item) => {
                  const selected = filter === item.key;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={item.key}
                      onPress={() => setFilter(item.key)}
                      style={({ pressed }) => [
                        styles.filterButton,
                        selected && styles.filterButtonActive,
                        pressed && styles.buttonPressed,
                      ]}>
                      <Text style={[styles.filterText, selected && styles.filterTextActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {products.length === 0 ? (
              <EmptyState
                title="No hay productos con stock"
                description="Intenta nuevamente cuando haya productos disponibles."
              />
            ) : visibleProducts.length === 0 ? (
              <EmptyState
                title="No encontramos productos"
                description="Prueba con otra búsqueda o cambia el filtro."
              />
            ) : (
              <View style={styles.productGrid}>
                {visibleProducts.map((product) => {
                  const quantity = quantities[product.id] ?? 0;
                  const selected = quantity > 0;
                  const lowStock = product.stock <= 5;
                  return (
                    <View
                      key={product.id}
                      style={[
                        styles.productCard,
                        isDesktop ? styles.productCardDesktop : styles.productCardMobile,
                        selected && styles.productCardSelected,
                      ]}>
                      <View style={styles.productCardTop}>
                        <View style={[styles.productBadge, selected && styles.productBadgeSelected]}>
                          <Text style={[styles.productBadgeText, selected && styles.productBadgeTextSelected]}>
                            {getInitials(product.nombre) || 'SS'}
                          </Text>
                        </View>
                        {selected ? (
                          <View style={styles.addedBadge}>
                            <Text style={styles.addedCheck}>✓</Text>
                            <Text style={styles.addedText}>Agregado</Text>
                          </View>
                        ) : null}
                      </View>

                      <Text numberOfLines={1} style={styles.productName}>{product.nombre}</Text>
                      <Text numberOfLines={2} style={styles.description}>
                        {product.descripcion || 'Producto disponible en SmartStock.'}
                      </Text>

                      <View style={styles.productFooter}>
                        <View style={styles.productPriceBlock}>
                          <Text style={styles.price}>{formatMoney(product.valor_unitario)}</Text>
                          <View style={[styles.stockBadge, lowStock && styles.stockBadgeLow]}>
                            <Text style={[styles.stockText, lowStock && styles.stockTextLow]}>
                              {lowStock
                                ? `Últimas ${product.stock} unidades`
                                : `Disponibles: ${product.stock}`}
                            </Text>
                          </View>
                        </View>

                        <QuantityStepper
                          disabled={saving}
                          product={product}
                          quantity={quantity}
                          onChange={changeQuantity}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {isDesktop ? (
            <View style={styles.summaryColumn}>
              <PurchaseSummary
                items={selectedItems}
                saving={saving}
                total={total}
                totalUnits={totalUnits}
                onConfirm={handlePurchase}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {!isDesktop && products.length > 0 ? (
        <View style={styles.mobileCheckoutBar}>
          <View style={styles.mobileCartBadge}><Text style={styles.mobileCartIcon}>SS</Text></View>
          <View style={styles.mobileTotalBlock}>
            <Text style={styles.mobileUnits}>
              {selectedItems.length} productos · {totalUnits} unidades
            </Text>
            <Text style={styles.mobileTotal}>{formatMoney(total)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={selectedItems.length === 0}
            onPress={() => setReviewVisible(true)}
            style={({ pressed }) => [
              styles.reviewButton,
              selectedItems.length === 0 && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}>
            <Text style={styles.reviewButtonText}>Ver resumen</Text>
            <Text style={styles.reviewButtonArrow}>›</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={() => setReviewVisible(false)}
        presentationStyle="pageSheet"
        visible={reviewVisible}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalEyebrow}>REVISA TU PEDIDO</Text>
              <Text style={styles.modalTitle}>Resumen de compra</Text>
            </View>
            <Pressable
              accessibilityLabel="Cerrar resumen"
              accessibilityRole="button"
              onPress={() => setReviewVisible(false)}
              style={({ pressed }) => [styles.closeButton, pressed && styles.buttonPressed]}>
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <PurchaseSummary
              items={selectedItems}
              saving={saving}
              total={total}
              totalUnits={totalUnits}
              onConfirm={handlePurchase}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyIcon}>SS</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{description}</Text>
    </View>
  );
}

function QuantityStepper({
  disabled,
  product,
  quantity,
  onChange,
}: {
  disabled: boolean;
  product: Product;
  quantity: number;
  onChange: (product: Product, difference: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityLabel={`Quitar una unidad de ${product.nombre}`}
        accessibilityRole="button"
        disabled={disabled || quantity === 0}
        onPress={() => onChange(product, -1)}
        style={({ pressed }) => [
          styles.stepButton,
          quantity === 0 && styles.stepButtonDisabled,
          pressed && quantity > 0 && styles.buttonPressed,
        ]}>
        <Text style={styles.stepMinus}>−</Text>
      </Pressable>
      <Text accessibilityLabel={`${quantity} unidades`} style={styles.stepValue}>{quantity}</Text>
      <Pressable
        accessibilityLabel={`Agregar una unidad de ${product.nombre}`}
        accessibilityRole="button"
        disabled={disabled || quantity >= product.stock}
        onPress={() => onChange(product, 1)}
        style={({ pressed }) => [
          styles.stepButton,
          styles.stepButtonAdd,
          quantity >= product.stock && styles.stepButtonDisabled,
          pressed && quantity < product.stock && styles.buttonPressed,
        ]}>
        <Text style={styles.stepPlus}>＋</Text>
      </Pressable>
    </View>
  );
}

function ShoppingBagIllustration() {
  return (
    <View style={styles.illustration}>
      <View style={styles.illustrationGlow} />
      <View style={styles.bagHandle} />
      <View style={styles.bagBody}><Text style={styles.bagLogo}>SS</Text></View>
      <View style={styles.sparkOne} />
      <View style={styles.sparkTwo} />
    </View>
  );
}

function PurchaseSummary({
  items,
  saving,
  total,
  totalUnits,
  onConfirm,
}: {
  items: SelectedItem[];
  saving: boolean;
  total: number;
  totalUnits: number;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHeading}>
        <View>
          <Text style={styles.summaryEyebrow}>TU PEDIDO</Text>
          <Text style={styles.summaryTitle}>Resumen de compra</Text>
        </View>
        <View style={styles.summaryCartIcon}><Text style={styles.summaryCartText}>SS</Text></View>
      </View>

      {items.length === 0 ? (
        <View style={styles.summaryEmpty}>
          <Text style={styles.summaryEmptyIcon}>＋</Text>
          <Text style={styles.summaryEmptyTitle}>Tu carrito está vacío</Text>
          <Text style={styles.summaryEmptyText}>Usa los botones + para agregar productos.</Text>
        </View>
      ) : (
        <View style={styles.summaryList}>
          {items.map((item) => (
            <View key={item.product.id} style={styles.summaryItem}>
              <View style={styles.summaryItemBadge}>
                <Text style={styles.summaryItemBadgeText}>{getInitials(item.product.nombre) || 'SS'}</Text>
              </View>
              <View style={styles.summaryItemInfo}>
                <Text numberOfLines={1} style={styles.summaryItemName}>{item.product.nombre}</Text>
                <Text style={styles.summaryItemQuantity}>
                  {item.quantity} {item.quantity === 1 ? 'unidad' : 'unidades'}
                </Text>
              </View>
              <Text style={styles.summaryItemTotal}>
                {formatMoney(item.product.valor_unitario * item.quantity)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.summaryStats}>
        <Text style={styles.summaryStat}>{items.length} productos</Text>
        <View style={styles.summaryDivider} />
        <Text style={styles.summaryStat}>{totalUnits} unidades</Text>
      </View>
      <View style={styles.summaryTotalRow}>
        <Text style={styles.summaryTotalLabel}>Total</Text>
        <Text style={styles.summaryTotal}>{formatMoney(total)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={saving || items.length === 0}
        onPress={onConfirm}
        style={({ pressed }) => [
          styles.purchaseButton,
          (saving || items.length === 0) && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}>
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Text style={styles.purchaseButtonText}>Finalizar compra</Text>
            <Text style={styles.purchaseButtonArrow}>›</Text>
          </>
        )}
      </Pressable>
      <View style={styles.secureRow}>
        <Text style={styles.secureIcon}>✓</Text>
        <Text style={styles.secureText}>Transacción segura</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7F5' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#F4F7F5' },
  loadingText: { color: '#647D75', fontSize: 14, fontWeight: '700' },
  container: { flexGrow: 1, width: '100%', alignSelf: 'center' },
  containerDesktop: { maxWidth: 1320, paddingHorizontal: 32, paddingTop: 28, paddingBottom: 48 },
  containerMobile: { padding: 16, paddingBottom: 28 },
  errorText: { color: '#B42318', backgroundColor: '#FFF1F0', borderWidth: 1, borderColor: '#FFD5D2', borderRadius: 12, padding: 14, lineHeight: 20, marginBottom: 16 },
  mainLayout: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 22 },
  mainLayoutMobile: { flexDirection: 'column' },
  catalogColumn: { flex: 1, minWidth: 0 },
  summaryColumn: { width: 350 },
  heroCard: { minHeight: 184, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden', borderWidth: 1, borderColor: '#BCE6D6', borderRadius: 24, paddingHorizontal: 34, paddingVertical: 28, backgroundColor: '#E8F6F0' },
  heroCardCompact: { minHeight: 0, padding: 22 },
  heroContent: { flex: 1, zIndex: 2 },
  heroEyebrow: { color: '#13795B', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 9 },
  heroTitle: { maxWidth: 580, color: '#173B32', fontSize: 31, lineHeight: 38, fontWeight: '900' },
  heroTitleCompact: { fontSize: 25, lineHeight: 31 },
  heroText: { color: '#4B6A61', fontSize: 16, lineHeight: 23, marginTop: 8 },
  illustration: { width: 220, height: 130, alignItems: 'center', justifyContent: 'flex-end' },
  illustrationGlow: { position: 'absolute', width: 150, height: 110, borderRadius: 60, backgroundColor: '#C9ECDF' },
  bagHandle: { position: 'absolute', top: 10, width: 62, height: 55, borderWidth: 7, borderColor: '#126B52', borderBottomWidth: 0, borderTopLeftRadius: 32, borderTopRightRadius: 32, zIndex: 2 },
  bagBody: { width: 112, height: 96, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: '#168563', transform: [{ rotate: '3deg' }], shadowColor: '#0B4F3F', shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.16, shadowRadius: 15, elevation: 5 },
  bagLogo: { color: '#E8F6F0', fontSize: 22, fontWeight: '900' },
  sparkOne: { position: 'absolute', right: 21, top: 20, width: 5, height: 24, borderRadius: 4, backgroundColor: '#13795B', transform: [{ rotate: '40deg' }] },
  sparkTwo: { position: 'absolute', right: 2, top: 48, width: 5, height: 19, borderRadius: 4, backgroundColor: '#13795B', transform: [{ rotate: '70deg' }] },
  toolsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, marginBottom: 18 },
  toolsRowMobile: { flexDirection: 'column', alignItems: 'stretch' },
  searchBox: { minHeight: 54, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#D4E2DD', borderRadius: 15, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  searchIcon: { color: '#607B72', fontSize: 28, lineHeight: 30 },
  searchInput: { flex: 1, minWidth: 0, color: '#173B32', fontSize: 15 },
  filters: { flexDirection: 'row', gap: 8 },
  filterButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D4E2DD', borderRadius: 23, paddingHorizontal: 18, backgroundColor: '#FFFFFF' },
  filterButtonActive: { borderColor: '#13795B', backgroundColor: '#13795B' },
  filterText: { color: '#35574D', fontSize: 13, fontWeight: '800' },
  filterTextActive: { color: '#FFFFFF' },
  emptyCard: { alignItems: 'center', borderWidth: 1, borderColor: '#DCE7E2', borderRadius: 20, padding: 38, backgroundColor: '#FFFFFF' },
  emptyIcon: { width: 52, height: 52, color: '#13795B', fontSize: 15, lineHeight: 52, fontWeight: '900', textAlign: 'center', borderRadius: 18, backgroundColor: '#DFF2EB', overflow: 'hidden', marginBottom: 14 },
  emptyTitle: { color: '#173B32', fontSize: 19, fontWeight: '900', textAlign: 'center' },
  emptyText: { maxWidth: 420, color: '#647D75', fontSize: 14, lineHeight: 21, marginTop: 7, textAlign: 'center' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  productCard: { minWidth: 0, minHeight: 236, justifyContent: 'space-between', borderWidth: 1, borderColor: '#DCE7E2', borderRadius: 20, padding: 18, backgroundColor: '#FFFFFF', shadowColor: '#173B32', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  productCardDesktop: { flexBasis: '48%', flexGrow: 1 },
  productCardMobile: { width: '100%' },
  productCardSelected: { borderWidth: 2, borderColor: '#20A678', padding: 17, backgroundColor: '#F0FBF7' },
  productCardTop: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  productBadge: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#E4ECE9' },
  productBadgeSelected: { backgroundColor: '#CDEFE2' },
  productBadgeText: { color: '#35574D', fontSize: 14, fontWeight: '900' },
  productBadgeTextSelected: { color: '#0B624A' },
  addedBadge: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, paddingHorizontal: 12, backgroundColor: '#D7F3E8' },
  addedCheck: { color: '#13795B', fontSize: 16, fontWeight: '900' },
  addedText: { color: '#126B52', fontSize: 12, fontWeight: '900' },
  productName: { color: '#173B32', fontSize: 18, fontWeight: '900', marginTop: 13 },
  description: { minHeight: 40, color: '#647D75', fontSize: 13, lineHeight: 19, marginTop: 4 },
  productFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 15 },
  productPriceBlock: { flex: 1, minWidth: 120 },
  price: { color: '#173B32', fontSize: 19, fontWeight: '900' },
  stockBadge: { alignSelf: 'flex-start', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, marginTop: 7, backgroundColor: '#DDF5EB' },
  stockBadgeLow: { backgroundColor: '#FFF0C9' },
  stockText: { color: '#13795B', fontSize: 11, fontWeight: '900' },
  stockTextLow: { color: '#A35D00' },
  stepper: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#CFE2DB', borderRadius: 14, padding: 4, backgroundColor: '#FFFFFF' },
  stepButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#E5EFEB' },
  stepButtonAdd: { backgroundColor: '#13795B' },
  stepButtonDisabled: { opacity: 0.38 },
  stepMinus: { color: '#35574D', fontSize: 23, lineHeight: 25, fontWeight: '900' },
  stepPlus: { color: '#FFFFFF', fontSize: 23, lineHeight: 25, fontWeight: '700' },
  stepValue: { minWidth: 34, color: '#173B32', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  summaryCard: { width: '100%', borderWidth: 1, borderColor: '#D6E4DF', borderRadius: 22, padding: 20, backgroundColor: '#FFFFFF', shadowColor: '#173B32', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 5 },
  summaryHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#E4ECE9', paddingBottom: 16 },
  summaryEyebrow: { color: '#4F8474', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  summaryTitle: { color: '#173B32', fontSize: 21, fontWeight: '900', marginTop: 4 },
  summaryCartIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#E5F5EF' },
  summaryCartText: { color: '#13795B', fontSize: 12, fontWeight: '900' },
  summaryEmpty: { alignItems: 'center', paddingVertical: 38 },
  summaryEmptyIcon: { width: 48, height: 48, color: '#13795B', fontSize: 27, lineHeight: 46, fontWeight: '500', textAlign: 'center', borderRadius: 24, backgroundColor: '#E8F6F0', overflow: 'hidden' },
  summaryEmptyTitle: { color: '#173B32', fontSize: 15, fontWeight: '900', marginTop: 13 },
  summaryEmptyText: { color: '#71847D', fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: 'center' },
  summaryList: { paddingVertical: 4 },
  summaryItem: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#E8EEEC', paddingVertical: 12 },
  summaryItemBadge: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#DFF2EB' },
  summaryItemBadgeText: { color: '#126B52', fontSize: 11, fontWeight: '900' },
  summaryItemInfo: { flex: 1, minWidth: 0 },
  summaryItemName: { color: '#173B32', fontSize: 13, fontWeight: '900' },
  summaryItemQuantity: { color: '#71847D', fontSize: 11, marginTop: 3 },
  summaryItemTotal: { color: '#173B32', fontSize: 12, fontWeight: '900' },
  summaryStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 16 },
  summaryStat: { color: '#647D75', fontSize: 12, fontWeight: '700' },
  summaryDivider: { width: 1, height: 20, backgroundColor: '#DCE7E2' },
  summaryTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderTopWidth: 1, borderTopColor: '#E4ECE9', paddingTop: 17 },
  summaryTotalLabel: { color: '#173B32', fontSize: 16, fontWeight: '900' },
  summaryTotal: { color: '#0B624A', fontSize: 23, fontWeight: '900' },
  purchaseButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: '#13795B', marginTop: 17 },
  purchaseButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  purchaseButtonArrow: { color: '#FFFFFF', fontSize: 25, lineHeight: 25 },
  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 13 },
  secureIcon: { color: '#609083', fontSize: 12, fontWeight: '900' },
  secureText: { color: '#71847D', fontSize: 11, fontWeight: '700' },
  mobileCheckoutBar: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#D6E4DF', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FFFFFF', shadowColor: '#173B32', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 12 },
  mobileCartBadge: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#E4F5EE' },
  mobileCartIcon: { color: '#13795B', fontSize: 11, fontWeight: '900' },
  mobileTotalBlock: { flex: 1, minWidth: 0 },
  mobileUnits: { color: '#71847D', fontSize: 10, fontWeight: '700' },
  mobileTotal: { color: '#173B32', fontSize: 17, fontWeight: '900', marginTop: 2 },
  reviewButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 15, backgroundColor: '#13795B' },
  reviewButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  reviewButtonArrow: { color: '#FFFFFF', fontSize: 22, lineHeight: 22 },
  buttonPressed: { opacity: 0.78 },
  buttonDisabled: { opacity: 0.45 },
  modalSafeArea: { flex: 1, backgroundColor: '#F4F7F5' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderBottomWidth: 1, borderBottomColor: '#DCE7E2', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF' },
  modalEyebrow: { color: '#4F8474', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  modalTitle: { color: '#173B32', fontSize: 22, fontWeight: '900', marginTop: 3 },
  closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D6E4DF', borderRadius: 14, backgroundColor: '#FFFFFF' },
  closeButtonText: { color: '#35574D', fontSize: 28, lineHeight: 30 },
  modalContent: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 16, paddingBottom: 36 },
});
