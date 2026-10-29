/**
 * RESUMEN DEL ARCHIVO
 * Muestra los productos de una compra específica. El cliente solo consulta;
 * el administrador puede cambiar cantidades, agregar o quitar detalles.
 */

// Hooks para estados, consultas y funciones reutilizables.
import { useCallback, useEffect, useState } from 'react';
// Navegación, recarga por enfoque y lectura del id enviado en la URL.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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

// Sesión y operaciones transaccionales que mantienen el stock correcto.
import { useAuth } from '@/context/auth-context';
import {
  addPurchaseDetail,
  deletePurchaseDetail,
  updateDetailQuantity,
} from '@/database/purchases';
import { supabase } from '@/lib/supabase';

// Información general de la compra y de su propietario.
type PurchaseHeader = {
  id: number;
  fecha: string;
  total: number;
  nombre: string;
  apellido: string;
  correo: string;
};

// Producto ya incluido en la compra.
type PurchaseDetail = {
  id: number;
  id_producto: number;
  nombre: string;
  cantidad: number;
  valor: number;
  stock: number;
};

// Producto que el administrador todavía puede agregar.
type AvailableProduct = {
  id: number;
  nombre: string;
  valor_unitario: number;
  stock: number;
};

type Message = {
  type: 'success' | 'error';
  text: string;
};

// Presenta subtotales y total en pesos colombianos.
function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

// Convierte la fecha guardada por Supabase a fecha y hora local.
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

function getInitials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function PurchaseDetailsScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 980;
  const isCompact = width < 560;
  // Lee el parámetro id de la ruta /detalles.
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  // Expo Router puede entregar uno o varios valores; aquí se toma solo el primero.
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  // Convierte el texto de la URL en número para usarlo en SQL.
  const purchaseId = Number(rawId);
  const { user, loading: authLoading } = useAuth();
  // Estados del encabezado, detalles, formularios y mensajes.
  const [header, setHeader] = useState<PurchaseHeader | null>(null);
  const [details, setDetails] = useState<PurchaseDetail[]>([]);
  const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [newQuantity, setNewQuantity] = useState('1');
  const [message, setMessage] = useState<Message | null>(null);

  // Simplifica permisos y elementos visibles.
  const isAdmin = user?.rol === 'admin';
  const totalUnits = details.reduce((sum, detail) => sum + detail.cantidad, 0);

  // Carga encabezado, detalles y productos disponibles para agregar.
  const loadDetails = useCallback(async () => {
    // Rechaza ids vacíos, decimales, negativos o iguales a cero.
    if (!user || !Number.isInteger(purchaseId) || purchaseId <= 0) {
      if (user) {
        setMessage({ type: 'error', text: 'El número de compra no es válido.' });
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      // RLS impide que un cliente obtenga compras pertenecientes a otra cuenta.
      const { data: headerRow, error: headerError } = await supabase
        .from('encabezados')
        .select('id, id_cliente, fecha, total')
        .eq('id', purchaseId)
        .maybeSingle();
      if (headerError) throw headerError;

      if (!headerRow) {
        setHeader(null);
        setMessage({ type: 'error', text: 'La compra no existe o no tienes permiso para verla.' });
        return;
      }

      const [clientResult, detailsResult, productsResult] = await Promise.all([
        supabase
          .from('clientes')
          .select('id_usuario, nombre, apellido')
          .eq('id', headerRow.id_cliente)
          .single(),
        supabase
          .from('detalles')
          .select('id, id_producto, cantidad, valor')
          .eq('id_encabezado', purchaseId),
        supabase
          .from('productos')
          .select('id, nombre, valor_unitario, stock')
          .order('nombre', { ascending: true }),
      ]);
      if (clientResult.error) throw clientResult.error;
      if (detailsResult.error) throw detailsResult.error;
      if (productsResult.error) throw productsResult.error;

      const profileResult = isAdmin
        ? await supabase
            .from('perfiles')
            .select('correo')
            .eq('id', clientResult.data.id_usuario)
            .maybeSingle()
        : { data: null, error: null };
      if (profileResult.error) throw profileResult.error;

      const productsById = new Map(productsResult.data.map((product) => [product.id, product]));
      const includedProductIds = new Set(detailsResult.data.map((detail) => detail.id_producto));
      const rows: PurchaseDetail[] = detailsResult.data.flatMap((detail) => {
        const product = productsById.get(detail.id_producto);
        if (!product) return [];
        return [{
          id: detail.id,
          id_producto: detail.id_producto,
          nombre: product.nombre,
          cantidad: detail.cantidad,
          valor: Number(detail.valor),
          stock: product.stock,
        }];
      });

      setHeader({
        id: headerRow.id,
        fecha: headerRow.fecha,
        total: Number(headerRow.total),
        nombre: clientResult.data.nombre,
        apellido: clientResult.data.apellido,
        correo: profileResult.data?.correo ?? 'Correo no disponible',
      });
      setDetails(rows.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
      setAvailableProducts(
        isAdmin
          ? productsResult.data
              .filter((product) => product.stock > 0 && !includedProductIds.has(product.id))
              .map((product) => ({ ...product, valor_unitario: Number(product.valor_unitario) }))
          : []
      );
    } catch {
      setMessage({ type: 'error', text: 'No fue posible cargar los detalles de la compra.' });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, purchaseId, user]);

  // Protege la ruta cuando no hay sesión.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user]);

  // Recarga los datos al regresar a la pantalla.
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadDetails();
      }
    }, [loadDetails, user])
  );

  // Prepara el formulario con la cantidad actual del detalle.
  function startEditing(detail: PurchaseDetail) {
    setEditingId(detail.id);
    setEditQuantity(String(detail.cantidad));
    setDeleteId(null);
    setShowAddForm(false);
    setMessage(null);
  }

  // Actualiza cantidad, stock, subtotal y total mediante una transacción.
  async function saveQuantity(detail: PurchaseDetail) {
    if (!isAdmin) {
      return;
    }

    try {
      setProcessingId(detail.id);
      setMessage(null);
      await updateDetailQuantity(detail.id, Number(editQuantity));
      setEditingId(null);
      setMessage({ type: 'success', text: 'La cantidad y el total fueron actualizados.' });
      await loadDetails();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No fue posible actualizar el detalle.',
      });
    } finally {
      setProcessingId(null);
    }
  }

  // Agrega a la compra un producto que aún no estaba incluido.
  async function addDetail() {
    if (!isAdmin || !selectedProductId) {
      setMessage({ type: 'error', text: 'Selecciona un producto.' });
      return;
    }

    try {
      setProcessingId(-1);
      setMessage(null);
      await addPurchaseDetail(purchaseId, selectedProductId, Number(newQuantity));
      setShowAddForm(false);
      setSelectedProductId(null);
      setNewQuantity('1');
      setMessage({ type: 'success', text: 'El producto fue agregado a la compra.' });
      await loadDetails();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No fue posible agregar el detalle.',
      });
    } finally {
      setProcessingId(null);
    }
  }

  // Elimina un detalle y devuelve sus unidades al inventario.
  async function removeDetail(detail: PurchaseDetail) {
    if (!isAdmin) {
      return;
    }

    try {
      setProcessingId(detail.id);
      setMessage(null);
      await deletePurchaseDetail(detail.id);
      setDeleteId(null);
      setMessage({
        type: 'success',
        text: 'El detalle fue eliminado y sus unidades regresaron al stock.',
      });
      await loadDetails();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No fue posible eliminar el detalle.',
      });
    } finally {
      setProcessingId(null);
    }
  }

  // No muestra información hasta recuperar la sesión.
  if (authLoading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#13795B" />
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
        {loading ? (
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#13795B" />
            <Text style={styles.loadingText}>Preparando tu comprobante...</Text>
          </View>
        ) : header ? (
          <>
            <View style={[styles.purchaseHero, isCompact && styles.purchaseHeroCompact]}>
              <View style={styles.heroDecorationOne} />
              <View style={styles.heroDecorationTwo} />
              <View style={styles.heroMain}>
                <View style={styles.completedBadge}>
                  <Text style={styles.completedCheck}>✓</Text>
                  <Text style={styles.completedText}>COMPRA COMPLETADA</Text>
                </View>
                <Text style={styles.purchaseNumber}>Compra #{String(header.id).padStart(3, '0')}</Text>
                <Text style={styles.purchaseOwner}>{header.nombre} {header.apellido}</Text>
                <Text style={styles.purchaseDate}>{formatDate(header.fecha)}</Text>
              </View>
              <View style={[styles.heroTotal, isCompact && styles.heroTotalCompact]}>
                <Text style={styles.heroTotalLabel}>TOTAL PAGADO</Text>
                <Text style={[styles.heroTotalValue, isCompact && styles.heroTotalValueCompact]}>
                  {formatMoney(header.total)}
                </Text>
              </View>
            </View>

            {message ? (
              <View style={[styles.message, message.type === 'error' ? styles.error : styles.success]}>
                <Text style={message.type === 'error' ? styles.errorText : styles.successText}>
                  {message.text}
                </Text>
              </View>
            ) : null}

            {isAdmin ? (
              <View style={styles.adminBar}>
                <View style={styles.adminInfo}>
                  <Text style={styles.adminEyebrow}>HERRAMIENTAS ADMINISTRATIVAS</Text>
                  <Text style={styles.adminText}>Puedes ajustar los productos y el inventario se actualizará automáticamente.</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.addButton, pressed && styles.buttonPressed]}
                  onPress={() => {
                    setShowAddForm((current) => !current);
                    setEditingId(null);
                    setDeleteId(null);
                    setMessage(null);
                  }}>
                  <Text style={styles.addButtonText}>{showAddForm ? 'Cerrar formulario' : '+ Agregar producto'}</Text>
                </Pressable>
              </View>
            ) : null}

            {isAdmin && showAddForm ? (
              <View style={styles.addForm}>
                <Text style={styles.formEyebrow}>EDITAR COMPROBANTE</Text>
                <Text style={styles.formTitle}>Agregar producto al detalle</Text>
                {availableProducts.length === 0 ? (
                  <Text style={styles.noProductsText}>No hay otros productos con stock disponible.</Text>
                ) : (
                  <>
                    <Text style={styles.label}>Selecciona un producto</Text>
                    <View style={styles.productChoices}>
                      {availableProducts.map((product) => (
                        <Pressable
                          key={product.id}
                          style={({ pressed }) => [
                            styles.productChoice,
                            selectedProductId === product.id && styles.productChoiceSelected,
                            pressed && styles.buttonPressed,
                          ]}
                          onPress={() => setSelectedProductId(product.id)}>
                          <Text style={[
                            styles.productChoiceName,
                            selectedProductId === product.id && styles.productChoiceNameSelected,
                          ]}>
                            {product.nombre}
                          </Text>
                          <Text style={styles.productChoiceInfo}>
                            {formatMoney(product.valor_unitario)} · Stock {product.stock}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.label}>Cantidad</Text>
                    <TextInput
                      style={styles.quantityInput}
                      value={newQuantity}
                      onChangeText={setNewQuantity}
                      keyboardType="number-pad"
                      editable={processingId !== -1}
                    />
                    <View style={styles.actions}>
                      <Pressable style={styles.secondaryButton} onPress={() => setShowAddForm(false)}>
                        <Text style={styles.secondaryButtonText}>Cancelar</Text>
                      </Pressable>
                      <Pressable style={styles.primaryButton} onPress={addDetail} disabled={processingId === -1}>
                        {processingId === -1 ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Agregar</Text>}
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ) : null}

            <View style={[styles.contentLayout, !isDesktop && styles.contentLayoutMobile]}>
              <View style={styles.invoiceCard}>
                <View style={styles.invoiceHeading}>
                  <View>
                    <Text style={styles.sectionEyebrow}>COMPROBANTE</Text>
                    <Text style={styles.sectionTitle}>Productos comprados</Text>
                  </View>
                  <View style={styles.itemCountBadge}>
                    <Text style={styles.itemCountText}>{details.length} {details.length === 1 ? 'producto' : 'productos'}</Text>
                  </View>
                </View>

                {isDesktop ? (
                  <View style={styles.tableHeading}>
                    <Text style={[styles.tableHeadingText, styles.productColumn]}>PRODUCTO</Text>
                    <Text style={styles.tableHeadingText}>PRECIO UNITARIO</Text>
                    <Text style={styles.tableHeadingText}>CANTIDAD</Text>
                    <Text style={[styles.tableHeadingText, styles.subtotalColumn]}>SUBTOTAL</Text>
                  </View>
                ) : null}

                <View style={styles.list}>
                  {details.map((detail) => {
                    const isEditing = editingId === detail.id;
                    const isDeleting = deleteId === detail.id;
                    const isProcessing = processingId === detail.id;
                    const unitPrice = detail.valor / detail.cantidad;

                    return (
                      <View key={detail.id} style={styles.detailCard}>
                        <View style={[styles.detailRow, !isDesktop && styles.detailRowMobile]}>
                          <View style={styles.productCell}>
                            <View style={styles.productInitials}>
                              <Text style={styles.productInitialsText}>{getInitials(detail.nombre) || 'SS'}</Text>
                            </View>
                            <View style={styles.detailInfo}>
                              <Text style={styles.productName}>{detail.nombre}</Text>
                              {!isDesktop ? <Text style={styles.mobileUnitPrice}>{formatMoney(unitPrice)} c/u</Text> : null}
                            </View>
                          </View>
                          {isDesktop ? <Text style={styles.valueCell}>{formatMoney(unitPrice)}</Text> : null}
                          <View style={styles.quantityBadge}>
                            <Text style={styles.quantityBadgeText}>{detail.cantidad}</Text>
                          </View>
                          <Text style={styles.lineTotal}>{formatMoney(detail.valor)}</Text>
                        </View>

                        {isEditing ? (
                          <View style={styles.editForm}>
                            <Text style={styles.label}>Nueva cantidad (disponibles para agregar: {detail.stock})</Text>
                            <TextInput
                              style={styles.quantityInput}
                              value={editQuantity}
                              onChangeText={setEditQuantity}
                              keyboardType="number-pad"
                              editable={!isProcessing}
                            />
                            <View style={styles.actions}>
                              <Pressable style={styles.secondaryButton} onPress={() => setEditingId(null)}>
                                <Text style={styles.secondaryButtonText}>Cancelar</Text>
                              </Pressable>
                              <Pressable style={styles.primaryButton} onPress={() => saveQuantity(detail)} disabled={isProcessing}>
                                {isProcessing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Guardar</Text>}
                              </Pressable>
                            </View>
                          </View>
                        ) : null}

                        {isDeleting ? (
                          <View style={styles.deleteConfirmation}>
                            <Text style={styles.confirmTitle}>¿Quitar este producto?</Text>
                            <Text style={styles.confirmText}>Las unidades volverán al stock.</Text>
                            <View style={styles.actions}>
                              <Pressable style={styles.secondaryButton} onPress={() => setDeleteId(null)}>
                                <Text style={styles.secondaryButtonText}>Cancelar</Text>
                              </Pressable>
                              <Pressable style={styles.deleteConfirmButton} onPress={() => removeDetail(detail)} disabled={isProcessing}>
                                {isProcessing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.deleteConfirmText}>Sí, quitar</Text>}
                              </Pressable>
                            </View>
                          </View>
                        ) : null}

                        {isAdmin && !isEditing && !isDeleting ? (
                          <View style={styles.adminActions}>
                            <Pressable style={styles.editLink} onPress={() => startEditing(detail)}>
                              <Text style={styles.editLinkText}>Editar cantidad</Text>
                            </Pressable>
                            <Pressable style={styles.removeLink} onPress={() => setDeleteId(detail.id)}>
                              <Text style={styles.removeLinkText}>Quitar producto</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={[styles.summaryCard, !isDesktop && styles.summaryCardMobile]}>
                <View style={styles.summaryIcon}><Text style={styles.summaryIconText}>SS</Text></View>
                <Text style={styles.summaryEyebrow}>RESUMEN</Text>
                <Text style={styles.summaryTitle}>Información de la compra</Text>
                <View style={styles.summaryInfoBlock}>
                  <Text style={styles.summaryInfoLabel}>CLIENTE</Text>
                  <Text style={styles.summaryInfoValue}>{header.nombre} {header.apellido}</Text>
                  {isAdmin ? <Text style={styles.summaryEmail}>{header.correo}</Text> : null}
                </View>
                <View style={styles.summaryRows}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Productos diferentes</Text>
                    <Text style={styles.summaryRowValue}>{details.length}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryRowLabel}>Total de unidades</Text>
                    <Text style={styles.summaryRowValue}>{totalUnits}</Text>
                  </View>
                </View>
                <View style={styles.summaryTotalRow}>
                  <Text style={styles.summaryTotalLabel}>Total pagado</Text>
                  <Text style={styles.summaryTotalValue}>{formatMoney(header.total)}</Text>
                </View>
                <View style={styles.registeredNotice}>
                  <Text style={styles.registeredCheck}>✓</Text>
                  <Text style={styles.registeredText}>Compra registrada correctamente</Text>
                </View>
              </View>
            </View>

            <View style={styles.timelineCard}>
              <Text style={styles.sectionEyebrow}>ESTADO DE LA OPERACIÓN</Text>
              <Text style={styles.timelineTitle}>Todo quedó actualizado</Text>
              <View style={[styles.timeline, isCompact && styles.timelineCompact]}>
                {['Compra creada', 'Inventario actualizado', 'Compra completada'].map((step, index) => (
                  <View key={step} style={[styles.timelineStep, isCompact && styles.timelineStepCompact]}>
                    <View style={styles.timelineCheck}><Text style={styles.timelineCheckText}>✓</Text></View>
                    <Text style={styles.timelineStepText}>{step}</Text>
                    {index < 2 ? <View style={[styles.timelineLine, isCompact && styles.timelineLineCompact]} /> : null}
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.completionBanner}>
              <View style={styles.completionIcon}><Text style={styles.completionIconText}>✓</Text></View>
              <View style={styles.completionContent}>
                <Text style={styles.completionTitle}>La compra quedó registrada</Text>
                <Text style={styles.completionText}>El inventario y los totales fueron actualizados correctamente.</Text>
              </View>
            </View>

            <View style={[styles.pageActions, isCompact && styles.pageActionsCompact]}>
              <Pressable
                style={({ pressed }) => [styles.backButton, isCompact && styles.actionButtonCompact, pressed && styles.buttonPressed]}
                onPress={() => router.push('/encabezados')}>
                <Text style={styles.backButtonText}>‹ Volver a compras</Text>
              </Pressable>
              {!isAdmin ? (
                <Pressable
                  style={({ pressed }) => [styles.newPurchaseButton, isCompact && styles.actionButtonCompact, pressed && styles.buttonPressed]}
                  onPress={() => router.push('/nueva-compra')}>
                  <Text style={styles.newPurchaseButtonText}>Realizar otra compra</Text>
                  <Text style={styles.newPurchaseArrow}>›</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>!</Text>
            <Text style={styles.emptyTitle}>Compra no disponible</Text>
            <Text style={styles.emptyText}>Regresa a Compras y selecciona otro registro.</Text>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/encabezados')}>
              <Text style={styles.primaryButtonText}>Volver a compras</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Estilos del módulo Detalle.
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7F5' },
  container: { flexGrow: 1, width: '100%', alignSelf: 'center' },
  containerDesktop: { maxWidth: 1240, paddingHorizontal: 32, paddingTop: 28, paddingBottom: 52 },
  containerMobile: { padding: 16, paddingBottom: 34 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F7F5' },
  loadingContent: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  loadingText: { color: '#647D75', fontSize: 15, marginTop: 12 },
  purchaseHero: { minHeight: 190, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 22, overflow: 'hidden', borderRadius: 24, paddingHorizontal: 32, paddingVertical: 28, marginBottom: 18, backgroundColor: '#0E7559' },
  purchaseHeroCompact: { minHeight: 0, flexDirection: 'column', alignItems: 'stretch', padding: 22 },
  heroDecorationOne: { position: 'absolute', right: -55, top: -85, width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(255,255,255,0.07)' },
  heroDecorationTwo: { position: 'absolute', right: 160, bottom: -95, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.04)' },
  heroMain: { flex: 1, zIndex: 1 },
  completedBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: 'rgba(220, 255, 242, 0.16)' },
  completedCheck: { color: '#D6F5E8', fontSize: 12, fontWeight: '900' },
  completedText: { color: '#D6F5E8', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  purchaseNumber: { color: '#FFFFFF', fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 15 },
  purchaseOwner: { color: '#E8F7F1', fontSize: 16, fontWeight: '800', marginTop: 4 },
  purchaseDate: { color: '#C6E7DC', fontSize: 13, marginTop: 6 },
  heroTotal: { minWidth: 245, alignItems: 'flex-end', zIndex: 1 },
  heroTotalCompact: { minWidth: 0, alignItems: 'flex-start', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', paddingTop: 17 },
  heroTotalLabel: { color: '#BCE5D7', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  heroTotalValue: { color: '#FFFFFF', fontSize: 35, fontWeight: '900', marginTop: 5 },
  heroTotalValueCompact: { fontSize: 28 },
  message: { borderRadius: 12, padding: 14, marginBottom: 16 },
  success: { backgroundColor: '#E6F6ED' },
  error: { backgroundColor: '#FDECEC' },
  successText: { color: '#1E6B42', fontSize: 15, fontWeight: '700' },
  errorText: { color: '#B42318', fontSize: 15, fontWeight: '700' },
  adminBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderWidth: 1, borderColor: '#D4E4DE', borderRadius: 17, padding: 15, marginBottom: 16, backgroundColor: '#FFFFFF' },
  adminInfo: { flex: 1, minWidth: 230 },
  adminEyebrow: { color: '#4F8474', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  adminText: { color: '#647D75', fontSize: 13, lineHeight: 19, marginTop: 4 },
  addButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#13795B', borderRadius: 11, paddingHorizontal: 15 },
  addButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  addForm: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B9D8CF', borderRadius: 18, padding: 20, marginBottom: 16 },
  formEyebrow: { color: '#4F8474', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  formTitle: { color: '#173B32', fontSize: 19, fontWeight: '900', marginTop: 4, marginBottom: 14 },
  noProductsText: { color: '#647D75', fontSize: 15 },
  label: { color: '#173B32', fontSize: 14, fontWeight: '800', marginBottom: 7 },
  productChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  productChoice: { borderWidth: 1, borderColor: '#D7E7E1', borderRadius: 11, padding: 12, backgroundColor: '#FFFFFF' },
  productChoiceSelected: { borderColor: '#13795B', backgroundColor: '#EAF4F0' },
  productChoiceName: { color: '#173B32', fontSize: 15, fontWeight: '800' },
  productChoiceNameSelected: { color: '#13795B' },
  productChoiceInfo: { color: '#647D75', fontSize: 13, marginTop: 3 },
  quantityInput: { width: 130, minHeight: 47, borderWidth: 1, borderColor: '#91BEAF', borderRadius: 10, paddingHorizontal: 13, color: '#173B32', backgroundColor: '#FFFFFF', fontSize: 16, marginBottom: 10 },
  contentLayout: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
  contentLayoutMobile: { flexDirection: 'column' },
  invoiceCard: { flex: 1, minWidth: 0, overflow: 'hidden', borderWidth: 1, borderColor: '#D9E6E2', borderRadius: 21, backgroundColor: '#FFFFFF' },
  invoiceHeading: { minHeight: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, borderBottomWidth: 1, borderBottomColor: '#E5ECE9', paddingHorizontal: 20, paddingVertical: 17 },
  sectionEyebrow: { color: '#4F8474', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  sectionTitle: { color: '#173B32', fontSize: 21, fontWeight: '900', marginTop: 4 },
  itemCountBadge: { borderRadius: 15, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#E6F4EF' },
  itemCountText: { color: '#13795B', fontSize: 11, fontWeight: '900' },
  tableHeading: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, backgroundColor: '#F5F8F7' },
  tableHeadingText: { width: 112, color: '#71847D', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  productColumn: { flex: 1 },
  subtotalColumn: { textAlign: 'right' },
  list: { paddingHorizontal: 20 },
  detailCard: { borderBottomWidth: 1, borderBottomColor: '#E6ECEA', paddingVertical: 16 },
  detailRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailRowMobile: { flexWrap: 'wrap' },
  productCell: { flex: 1, minWidth: 170, flexDirection: 'row', alignItems: 'center', gap: 11 },
  productInitials: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#DFF2EB' },
  productInitialsText: { color: '#126B52', fontSize: 11, fontWeight: '900' },
  detailInfo: { flex: 1 },
  productName: { color: '#173B32', fontSize: 15, fontWeight: '900' },
  mobileUnitPrice: { color: '#71847D', fontSize: 11, marginTop: 3 },
  valueCell: { width: 112, color: '#49665D', fontSize: 13, fontWeight: '700' },
  quantityBadge: { width: 112, alignItems: 'flex-start' },
  quantityBadgeText: { minWidth: 34, color: '#13795B', fontSize: 12, fontWeight: '900', textAlign: 'center', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#E5F5EF', overflow: 'hidden' },
  lineTotal: { width: 112, color: '#173B32', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  editForm: { borderTopWidth: 1, borderTopColor: '#DCE7E2', paddingTop: 14, marginTop: 13 },
  adminActions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  editLink: { paddingVertical: 5 },
  editLinkText: { color: '#13795B', fontSize: 12, fontWeight: '900' },
  removeLink: { paddingVertical: 5 },
  removeLinkText: { color: '#B42318', fontSize: 12, fontWeight: '900' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 9 },
  primaryButton: { minWidth: 105, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 16, backgroundColor: '#13795B' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#91BEAF', borderRadius: 10, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#13795B', fontSize: 14, fontWeight: '800' },
  deleteButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D05A5A', borderRadius: 10, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  deleteButtonText: { color: '#B42318', fontSize: 14, fontWeight: '800' },
  deleteConfirmation: { backgroundColor: '#FFF1F0', borderRadius: 12, padding: 15 },
  confirmTitle: { color: '#8F1D14', fontSize: 16, fontWeight: '900' },
  confirmText: { color: '#8F1D14', fontSize: 14, marginTop: 5 },
  deleteConfirmButton: { minWidth: 105, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 16, backgroundColor: '#B42318' },
  deleteConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  summaryCard: { width: 340, borderWidth: 1, borderColor: '#D9E6E2', borderRadius: 21, padding: 20, backgroundColor: '#FFFFFF', shadowColor: '#173B32', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 3 },
  summaryCardMobile: { width: '100%' },
  summaryIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#DFF2EB' },
  summaryIconText: { color: '#13795B', fontSize: 12, fontWeight: '900' },
  summaryEyebrow: { color: '#4F8474', fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 16 },
  summaryTitle: { color: '#173B32', fontSize: 20, fontWeight: '900', marginTop: 4 },
  summaryInfoBlock: { borderRadius: 14, padding: 14, marginTop: 17, backgroundColor: '#F1F7F5' },
  summaryInfoLabel: { color: '#71847D', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  summaryInfoValue: { color: '#173B32', fontSize: 14, fontWeight: '900', marginTop: 5 },
  summaryEmail: { color: '#647D75', fontSize: 11, marginTop: 3 },
  summaryRows: { gap: 12, paddingVertical: 18 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  summaryRowLabel: { color: '#647D75', fontSize: 13 },
  summaryRowValue: { color: '#173B32', fontSize: 14, fontWeight: '900' },
  summaryTotalRow: { borderTopWidth: 1, borderTopColor: '#DCE7E2', paddingTop: 17 },
  summaryTotalLabel: { color: '#647D75', fontSize: 12, fontWeight: '800' },
  summaryTotalValue: { color: '#0B624A', fontSize: 26, fontWeight: '900', marginTop: 4 },
  registeredNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginTop: 17, backgroundColor: '#E5F6EE' },
  registeredCheck: { color: '#13795B', fontSize: 13, fontWeight: '900' },
  registeredText: { flex: 1, color: '#126B52', fontSize: 11, lineHeight: 16, fontWeight: '800' },
  timelineCard: { borderWidth: 1, borderColor: '#D9E6E2', borderRadius: 20, padding: 20, marginTop: 18, backgroundColor: '#FFFFFF' },
  timelineTitle: { color: '#173B32', fontSize: 20, fontWeight: '900', marginTop: 4 },
  timeline: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 22 },
  timelineCompact: { flexDirection: 'column', gap: 0 },
  timelineStep: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  timelineStepCompact: { width: '100%', minHeight: 58, flex: 0 },
  timelineCheck: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#13795B', zIndex: 1 },
  timelineCheckText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  timelineStepText: { flex: 1, color: '#35574D', fontSize: 12, lineHeight: 17, fontWeight: '900', marginLeft: 9 },
  timelineLine: { position: 'absolute', left: '66%', right: -4, top: 16, height: 2, backgroundColor: '#9FD2C0' },
  timelineLineCompact: { left: 16, right: 'auto', top: 34, width: 2, height: 24 },
  completionBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#BDE3D4', borderRadius: 18, padding: 17, marginTop: 14, backgroundColor: '#E9F8F2' },
  completionIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#13795B' },
  completionIconText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  completionContent: { flex: 1 },
  completionTitle: { color: '#126B52', fontSize: 15, fontWeight: '900' },
  completionText: { color: '#4D7468', fontSize: 12, lineHeight: 18, marginTop: 3 },
  pageActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 18 },
  pageActionsCompact: { flexDirection: 'column' },
  backButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#9AC8B9', borderRadius: 13, paddingHorizontal: 18, backgroundColor: '#FFFFFF' },
  backButtonText: { color: '#13795B', fontSize: 14, fontWeight: '900' },
  newPurchaseButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, paddingHorizontal: 20, backgroundColor: '#13795B' },
  newPurchaseButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  newPurchaseArrow: { color: '#FFFFFF', fontSize: 23, lineHeight: 23 },
  actionButtonCompact: { width: '100%' },
  buttonPressed: { opacity: 0.78 },
  emptyCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE7E2', borderRadius: 18, padding: 34 },
  emptyIcon: { width: 48, height: 48, color: '#B87915', fontSize: 20, lineHeight: 48, fontWeight: '900', textAlign: 'center', borderRadius: 16, backgroundColor: '#FFF0CF', overflow: 'hidden', marginBottom: 13 },
  emptyTitle: { color: '#173B32', fontSize: 19, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#647D75', fontSize: 15, lineHeight: 21, marginTop: 7, marginBottom: 16, textAlign: 'center' },
});
