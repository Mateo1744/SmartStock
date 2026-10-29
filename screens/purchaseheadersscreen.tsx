/**
 * RESUMEN DEL ARCHIVO
 * Muestra el historial de encabezados de compra. El cliente ve solo los suyos;
 * el administrador ve todos y puede eliminarlos restaurando el stock.
 */

// Hooks para estado, consultas y recarga al volver a la pantalla.
import { useCallback, useEffect, useState } from 'react';
// Navegación y evento de enfoque.
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Sesión actual y operación segura para eliminar compras.
import { useAuth } from '@/context/auth-context';
import { deletePurchase } from '@/database/purchases';
import { supabase } from '@/lib/supabase';

// Resultado de la consulta del encabezado unido con Cliente y Detalles.
type PurchaseHeader = {
  id: number;
  fecha: string;
  total: number;
  nombre: string;
  apellido: string;
  correo: string;
  unidades: number;
};

type Message = {
  type: 'success' | 'error';
  text: string;
};

// Presenta el total en pesos colombianos.
function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

// Presenta fecha y hora de Supabase en formato local.
function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function PurchaseHeadersScreen() {
  // Dependencias y estados de datos, carga y eliminación.
  const { user, loading: authLoading } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  // Determina alcance de la consulta y botones disponibles.
  const isAdmin = user?.rol === 'admin';

  // Admin consulta todo; cliente filtra por su id de Login.
  const loadPurchases = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      setLoading(true);
      // RLS entrega todas las compras al admin y únicamente las propias al cliente.
      const { data: headers, error: headersError } = await supabase
        .from('encabezados')
        .select('id, id_cliente, fecha, total')
        .order('fecha', { ascending: false })
        .order('id', { ascending: false });
      if (headersError) throw headersError;

      const clientIds = [...new Set(headers.map((header) => header.id_cliente))];
      const purchaseIds = headers.map((header) => header.id);
      const [clientsResult, detailsResult] = await Promise.all([
        clientIds.length
          ? supabase
              .from('clientes')
              .select('id, id_usuario, nombre, apellido')
              .in('id', clientIds)
          : Promise.resolve({ data: [], error: null }),
        purchaseIds.length
          ? supabase
              .from('detalles')
              .select('id_encabezado, cantidad')
              .in('id_encabezado', purchaseIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (clientsResult.error) throw clientsResult.error;
      if (detailsResult.error) throw detailsResult.error;

      const userIds = clientsResult.data.map((client) => client.id_usuario);
      const profilesResult = userIds.length
        ? await supabase.from('perfiles').select('id, correo').in('id', userIds)
        : { data: [], error: null };
      if (profilesResult.error) throw profilesResult.error;

      const clients = new Map(clientsResult.data.map((client) => [client.id, client]));
      const emails = new Map(profilesResult.data.map((profile) => [profile.id, profile.correo]));
      const unitCounts = new Map<number, number>();
      detailsResult.data.forEach((detail) => {
        unitCounts.set(
          detail.id_encabezado,
          (unitCounts.get(detail.id_encabezado) ?? 0) + detail.cantidad
        );
      });

      setPurchases(
        headers.flatMap((header) => {
          const client = clients.get(header.id_cliente);
          if (!client) return [];
          return [{
            id: header.id,
            fecha: header.fecha,
            total: Number(header.total),
            nombre: client.nombre,
            apellido: client.apellido,
            correo: emails.get(client.id_usuario) ?? 'Correo no disponible',
            unidades: unitCounts.get(header.id) ?? 0,
          }];
        })
      );
    } catch {
      setMessage({ type: 'error', text: 'No fue posible cargar las compras.' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Protege la ruta si la sesión se perdió.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user]);

  // Actualiza el historial al volver de Detalles o Nueva compra.
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadPurchases();
      }
    }, [loadPurchases, user])
  );

  // Solo el admin puede eliminar; la función devuelve existencias al inventario.
  async function handleDelete(purchase: PurchaseHeader) {
    if (!isAdmin) {
      return;
    }

    try {
      setDeletingId(purchase.id);
      setMessage(null);
      await deletePurchase(purchase.id);
      setConfirmDeleteId(null);
      setMessage({
        type: 'success',
        text: `La compra #${purchase.id} fue eliminada y el stock fue restaurado.`,
      });
      await loadPurchases();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No fue posible eliminar la compra.',
      });
    } finally {
      setDeletingId(null);
    }
  }

  // Muestra carga mientras se recupera la sesión.
  if (authLoading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#176B87" />
      </View>
    );
  }

  // Interfaz de historial y confirmación de eliminación.
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.introCard}>
          <View style={styles.introTextContainer}>
            <Text style={styles.introTitle}>{isAdmin ? 'Encabezados de compra' : 'Mis compras'}</Text>
            <Text style={styles.introText}>
              {isAdmin
                ? 'Consulta todas las compras y administra sus encabezados y detalles.'
                : 'Crea una compra nueva o consulta las que ya realizaste.'}
            </Text>
          </View>
          {!isAdmin ? (
            <Pressable style={styles.newButton} onPress={() => router.push('/nueva-compra')}>
              <Text style={styles.newButtonText}>Nueva compra</Text>
            </Pressable>
          ) : null}
        </View>

        {message ? (
          <View style={[styles.message, message.type === 'error' ? styles.error : styles.success]}>
            <Text style={message.type === 'error' ? styles.errorText : styles.successText}>
              {message.text}
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#176B87" />
            <Text style={styles.loadingText}>Cargando compras...</Text>
          </View>
        ) : purchases.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No hay compras registradas</Text>
            <Text style={styles.emptyText}>
              {isAdmin
                ? 'Las compras realizadas por los clientes aparecerán aquí.'
                : 'Pulsa “Nueva compra” para crear la primera.'}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            <Text style={styles.countText}>
              {purchases.length} {purchases.length === 1 ? 'compra' : 'compras'}
            </Text>

            {purchases.map((purchase) => {
              const isConfirming = confirmDeleteId === purchase.id;
              const isDeleting = deletingId === purchase.id;

              return (
                <View key={purchase.id} style={styles.purchaseCard}>
                  <View style={styles.purchaseHeader}>
                    <View style={styles.purchaseInfo}>
                      <Text style={styles.purchaseNumber}>COMPRA #{purchase.id}</Text>
                      <Text style={styles.clientName}>
                        {purchase.nombre} {purchase.apellido}
                      </Text>
                      {isAdmin ? <Text style={styles.email}>{purchase.correo}</Text> : null}
                      <Text style={styles.date}>{formatDate(purchase.fecha)}</Text>
                    </View>
                    <View style={styles.totalBox}>
                      <Text style={styles.total}>{formatMoney(purchase.total)}</Text>
                      <Text style={styles.units}>
                        {purchase.unidades} {purchase.unidades === 1 ? 'unidad' : 'unidades'}
                      </Text>
                    </View>
                  </View>

                  {isConfirming ? (
                    <View style={styles.deleteConfirmation}>
                      <Text style={styles.confirmTitle}>¿Eliminar esta compra?</Text>
                      <Text style={styles.confirmText}>
                        Los detalles se eliminarán y las cantidades volverán al stock.
                      </Text>
                      <View style={styles.actions}>
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => setConfirmDeleteId(null)}
                          disabled={isDeleting}>
                          <Text style={styles.secondaryButtonText}>Cancelar</Text>
                        </Pressable>
                        <Pressable
                          style={styles.deleteConfirmButton}
                          onPress={() => handleDelete(purchase)}
                          disabled={isDeleting}>
                          {isDeleting ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <Text style={styles.deleteConfirmText}>Sí, eliminar</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.actions}>
                      <Pressable
                        style={styles.primaryButton}
                        onPress={() =>
                          router.push({ pathname: '/detalles', params: { id: String(purchase.id) } })
                        }>
                        <Text style={styles.primaryButtonText}>Ver detalles</Text>
                      </Pressable>
                      {isAdmin ? (
                        <Pressable
                          style={styles.deleteButton}
                          onPress={() => setConfirmDeleteId(purchase.id)}>
                          <Text style={styles.deleteButtonText}>Eliminar compra</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Estilos del módulo Encabezado.
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7FA' },
  container: { flexGrow: 1, width: '100%', maxWidth: 900, alignSelf: 'center', padding: 24 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F7FA' },
  introCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18, backgroundColor: '#176B87', borderRadius: 20, padding: 24, marginBottom: 20 },
  introTextContainer: { flex: 1 },
  introTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '900' },
  introText: { color: '#E7F5F8', fontSize: 16, lineHeight: 23, marginTop: 8 },
  newButton: { backgroundColor: '#FFFFFF', borderRadius: 11, paddingHorizontal: 17, paddingVertical: 13 },
  newButtonText: { color: '#176B87', fontSize: 14, fontWeight: '900' },
  message: { borderRadius: 12, padding: 14, marginBottom: 16 },
  success: { backgroundColor: '#E6F6ED' },
  error: { backgroundColor: '#FDECEC' },
  successText: { color: '#1E6B42', fontSize: 15, fontWeight: '700' },
  errorText: { color: '#B42318', fontSize: 15, fontWeight: '700' },
  centerContent: { alignItems: 'center', justifyContent: 'center', paddingVertical: 70 },
  loadingText: { color: '#5F7181', fontSize: 15, marginTop: 12 },
  emptyCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E9EE', borderRadius: 18, padding: 34 },
  emptyTitle: { color: '#14324A', fontSize: 19, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#5F7181', fontSize: 15, lineHeight: 21, marginTop: 7, textAlign: 'center' },
  list: { gap: 14 },
  countText: { color: '#5F7181', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  purchaseCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E9EE', borderRadius: 17, padding: 20, gap: 15 },
  purchaseHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  purchaseInfo: { flex: 1, gap: 4 },
  purchaseNumber: { color: '#176B87', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  clientName: { color: '#14324A', fontSize: 19, fontWeight: '900' },
  email: { color: '#5F7181', fontSize: 14 },
  date: { color: '#6C7F8F', fontSize: 14 },
  totalBox: { alignItems: 'flex-end' },
  total: { color: '#176B87', fontSize: 20, fontWeight: '900' },
  units: { color: '#5F7181', fontSize: 13, marginTop: 4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 9 },
  primaryButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 17, backgroundColor: '#176B87' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#AAC1CE', borderRadius: 10, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  secondaryButtonText: { color: '#176B87', fontSize: 14, fontWeight: '800' },
  deleteButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D05A5A', borderRadius: 10, paddingHorizontal: 16, backgroundColor: '#FFFFFF' },
  deleteButtonText: { color: '#B42318', fontSize: 14, fontWeight: '800' },
  deleteConfirmation: { backgroundColor: '#FFF1F0', borderRadius: 12, padding: 15 },
  confirmTitle: { color: '#8F1D14', fontSize: 16, fontWeight: '900' },
  confirmText: { color: '#8F1D14', fontSize: 14, lineHeight: 20, marginTop: 5 },
  deleteConfirmButton: { minWidth: 112, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 16, backgroundColor: '#B42318' },
  deleteConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
