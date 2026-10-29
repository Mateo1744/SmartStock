/**
 * RESUMEN DEL ARCHIVO
 * Gestiona el módulo Cliente. El administrador puede consultar, editar,
 * activar, inactivar y eliminar; el cliente únicamente consulta y edita su perfil.
 */

// Hooks de React para estado, efectos y funciones reutilizables.
import { useCallback, useEffect, useState } from 'react';
// Herramientas de navegación y recarga al regresar a la pantalla.
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Entrega el usuario actual.
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';

// Columnas mostradas por cada tarjeta de cliente.
type Client = {
  id: number;
  id_usuario: string;
  nombre: string;
  apellido: string;
  correo: string;
  fecha_creacion: string;
  estado: 'activo' | 'inactivo';
  compras: number;
};

// Estructura común para mensajes verdes o rojos.
type Message = {
  type: 'success' | 'error';
  text: string;
};

// Convierte la fecha de Supabase a un texto entendible en español.
function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ClientsScreen() {
  const { user, loading: authLoading } = useAuth();
  // Estados de datos, carga, edición, eliminación y mensajes.
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  // Define qué consulta y qué botones debe ver la persona conectada.
  const isAdmin = user?.rol === 'admin';

  // Carga todos los clientes para admin o únicamente el perfil propio para cliente.
  const loadClients = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      setLoading(true);

      let clientsQuery = supabase
        .from('clientes')
        .select('id, id_usuario, nombre, apellido, fecha_creacion')
        .order('nombre', { ascending: true })
        .order('apellido', { ascending: true });

      if (!isAdmin) clientsQuery = clientsQuery.eq('id_usuario', user.id);

      const { data: clientRows, error: clientsError } = await clientsQuery;
      if (clientsError) throw clientsError;

      const userIds = clientRows.map((client) => client.id_usuario);
      const clientIds = clientRows.map((client) => client.id);

      const [profilesResult, purchasesResult] = await Promise.all([
        userIds.length
          ? supabase.from('perfiles').select('id, correo, estado').in('id', userIds)
          : Promise.resolve({ data: [], error: null }),
        clientIds.length
          ? supabase.from('encabezados').select('id_cliente').in('id_cliente', clientIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (purchasesResult.error) throw purchasesResult.error;

      const profiles = new Map(profilesResult.data.map((profile) => [profile.id, profile]));
      const purchaseCounts = new Map<number, number>();
      purchasesResult.data.forEach((purchase) => {
        purchaseCounts.set(
          purchase.id_cliente,
          (purchaseCounts.get(purchase.id_cliente) ?? 0) + 1
        );
      });

      const rows: Client[] = clientRows.map((client) => {
        const profile = profiles.get(client.id_usuario);
        return {
          ...client,
          correo: profile?.correo ?? 'Correo no disponible',
          estado: profile?.estado === 'inactivo' ? 'inactivo' : 'activo',
          compras: purchaseCounts.get(client.id) ?? 0,
        };
      });

      // Un cliente sin perfil debe completar primero sus datos.
      if (!isAdmin && rows.length === 0) {
        router.replace('/perfil');
        return;
      }

      setClients(rows);
    } catch {
      setMessage({ type: 'error', text: 'No fue posible cargar la información de clientes.' });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user]);

  // Protege la ruta cuando no existe una sesión.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user]);

  // Recarga la lista al abrir o regresar a esta pantalla.
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadClients();
      }
    }, [loadClients, user])
  );

  // Copia los datos seleccionados a los campos de edición.
  function startEditing(client: Client) {
    setEditingId(client.id);
    setEditName(client.nombre);
    setEditLastName(client.apellido);
    setEditEmail(client.correo);
    setDeleteId(null);
    setMessage(null);
  }

  // Cierra y limpia el formulario de edición.
  function cancelEditing() {
    setEditingId(null);
    setEditName('');
    setEditLastName('');
    setEditEmail('');
  }

  // Valida y actualiza Cliente y Login dentro de una transacción.
  async function saveClient(client: Client) {
    const cleanName = editName.trim();
    const cleanLastName = editLastName.trim();
    const cleanEmail = editEmail.trim().toLowerCase();

    // Impide que un cliente intente modificar otra cuenta.
    if (!user || (!isAdmin && client.id_usuario !== user.id)) {
      return;
    }

    if (cleanName.length < 2 || cleanLastName.length < 2) {
      setMessage({ type: 'error', text: 'Escribe un nombre y un apellido válidos.' });
      return;
    }

    try {
      setProcessingId(client.id);
      setMessage(null);

      if (cleanEmail !== client.correo) {
        setMessage({
          type: 'error',
          text: 'Por seguridad, el correo de acceso se cambia desde Supabase Auth.',
        });
        return;
      }

      const { error } = await supabase
        .from('clientes')
        .update({ nombre: cleanName, apellido: cleanLastName })
        .eq('id', client.id);

      if (error) throw error;

      cancelEditing();
      setMessage({ type: 'success', text: 'Los datos del cliente fueron actualizados.' });
      await loadClients();
    } catch {
      setMessage({ type: 'error', text: 'No fue posible actualizar el cliente.' });
    } finally {
      setProcessingId(null);
    }
  }

  // Permite al administrador activar o inactivar una cuenta cliente.
  async function changeStatus(client: Client) {
    if (!isAdmin) {
      return;
    }

    const newStatus = client.estado === 'activo' ? 'inactivo' : 'activo';

    try {
      setProcessingId(client.id);
      setMessage(null);
      setDeleteId(null);

      const { error } = await supabase
        .from('perfiles')
        .update({ estado: newStatus })
        .eq('id', client.id_usuario)
        .eq('rol', 'cliente');

      if (error) throw error;

      setMessage({
        type: 'success',
        text:
          newStatus === 'activo'
            ? `La cuenta de ${client.correo} fue activada.`
            : `La cuenta de ${client.correo} fue inactivada.`,
      });
      await loadClients();
    } catch {
      setMessage({ type: 'error', text: 'No fue posible cambiar el estado del cliente.' });
    } finally {
      setProcessingId(null);
    }
  }

  // Abre la confirmación únicamente si el cliente no tiene historial.
  function requestDelete(client: Client) {
    setMessage(null);
    cancelEditing();

    // Una compra existente obliga a conservar el cliente para mantener relaciones.
    if (client.compras > 0) {
      setDeleteId(null);
      setMessage({
        type: 'error',
        text: `${client.nombre} tiene compras registradas. Para conservar el historial, solo puedes inactivar su cuenta.`,
      });
      return;
    }

    setDeleteId(client.id);
  }

  // Elimina definitivamente la cuenta y su perfil si sigue siendo seguro hacerlo.
  async function deleteClient(client: Client) {
    if (!isAdmin) {
      return;
    }

    try {
      setProcessingId(client.id);
      setMessage(null);

      // Vuelve a comprobar la existencia de compras justo antes de eliminar.
      const { data: purchase, error: purchaseError } = await supabase
        .from('encabezados')
        .select('id')
        .eq('id_cliente', client.id)
        .limit(1)
        .maybeSingle();

      if (purchaseError) throw purchaseError;

      if (purchase) {
        setDeleteId(null);
        setMessage({
          type: 'error',
          text: 'El cliente ya tiene compras. Puedes inactivarlo, pero no eliminar su historial.',
        });
        await loadClients();
        return;
      }

      const { error } = await supabase.rpc('eliminar_cuenta_cliente', {
        p_usuario_id: client.id_usuario,
      });

      if (error) throw error;

      setDeleteId(null);
      setMessage({ type: 'success', text: 'El cliente y su cuenta fueron eliminados.' });
      await loadClients();
    } catch {
      setMessage({ type: 'error', text: 'No fue posible eliminar el cliente.' });
    } finally {
      setProcessingId(null);
    }
  }

  // Muestra carga mientras se obtiene la sesión.
  if (authLoading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#13795B" />
      </View>
    );
  }

  // Interfaz de lista, formularios de edición y confirmación de eliminación.
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>{isAdmin ? 'Clientes registrados' : 'Mi perfil'}</Text>
          <Text style={styles.introText}>
            {isAdmin
              ? 'Consulta, edita, inactiva o elimina clientes sin perder el historial de compras.'
              : 'Consulta y actualiza los datos asociados a tu cuenta de cliente.'}
          </Text>
        </View>

        {message ? (
          <View style={[styles.message, message.type === 'error' ? styles.error : styles.success]}>
            <Text style={message.type === 'error' ? styles.errorText : styles.successText}>
              {message.text}
            </Text>
          </View>
        ) : null}

        {/* Cambia entre carga, lista vacía y tarjetas con resultados. */}
        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#13795B" />
            <Text style={styles.loadingText}>Cargando clientes...</Text>
          </View>
        ) : clients.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No hay clientes registrados</Text>
            <Text style={styles.emptyText}>
              Los usuarios aparecerán aquí después de completar su perfil.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {isAdmin ? (
              <Text style={styles.countText}>
                {clients.length} {clients.length === 1 ? 'cliente registrado' : 'clientes registrados'}
              </Text>
            ) : null}

            {clients.map((client) => {
              const isEditing = editingId === client.id;
              const isDeleting = deleteId === client.id;
              const isProcessing = processingId === client.id;

              return (
                <View key={client.id} style={styles.clientCard}>
                  <View style={styles.clientHeader}>
                    <View style={styles.clientInfo}>
                      <Text
                        style={[
                          styles.statusLabel,
                          client.estado === 'activo' ? styles.activeText : styles.inactiveText,
                        ]}>
                        {client.estado.toUpperCase()}
                      </Text>
                      <Text style={styles.clientName}>
                        {client.nombre} {client.apellido}
                      </Text>
                      <Text style={styles.email}>{client.correo}</Text>
                    </View>
                    <View style={styles.purchaseBadge}>
                      <Text style={styles.purchaseNumber}>{client.compras}</Text>
                      <Text style={styles.purchaseText}>
                        {client.compras === 1 ? 'compra' : 'compras'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.date}>Cliente desde: {formatDate(client.fecha_creacion)}</Text>

                  {isEditing ? (
                    <View style={styles.editForm}>
                      <Text style={styles.label}>Nombre</Text>
                      <TextInput
                        style={styles.input}
                        value={editName}
                        onChangeText={setEditName}
                        autoCapitalize="words"
                        editable={!isProcessing}
                      />
                      <Text style={styles.label}>Apellido</Text>
                      <TextInput
                        style={styles.input}
                        value={editLastName}
                        onChangeText={setEditLastName}
                        autoCapitalize="words"
                        editable={!isProcessing}
                      />
                      <Text style={styles.label}>Correo electrónico</Text>
                      <TextInput
                        style={styles.input}
                        value={editEmail}
                        onChangeText={setEditEmail}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        editable={!isProcessing}
                      />
                      <View style={styles.actions}>
                        <Pressable style={styles.secondaryButton} onPress={cancelEditing}>
                          <Text style={styles.secondaryButtonText}>Cancelar</Text>
                        </Pressable>
                        <Pressable
                          style={styles.primaryButton}
                          onPress={() => saveClient(client)}
                          disabled={isProcessing}>
                          {isProcessing ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <Text style={styles.primaryButtonText}>Guardar</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  {isDeleting ? (
                    <View style={styles.deleteConfirmation}>
                      <Text style={styles.confirmTitle}>¿Eliminar definitivamente?</Text>
                      <Text style={styles.confirmText}>
                        Se eliminarán el cliente y su cuenta de acceso. Esta acción no se puede deshacer.
                      </Text>
                      <View style={styles.actions}>
                        <Pressable style={styles.secondaryButton} onPress={() => setDeleteId(null)}>
                          <Text style={styles.secondaryButtonText}>Cancelar</Text>
                        </Pressable>
                        <Pressable
                          style={styles.deleteConfirmButton}
                          onPress={() => deleteClient(client)}
                          disabled={isProcessing}>
                          {isProcessing ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <Text style={styles.deleteConfirmText}>Sí, eliminar</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  {!isEditing && !isDeleting ? (
                    <View style={styles.actionsWrap}>
                      <Pressable style={styles.secondaryButton} onPress={() => startEditing(client)}>
                        <Text style={styles.secondaryButtonText}>Editar</Text>
                      </Pressable>
                      {isAdmin ? (
                        <>
                          <Pressable style={styles.statusButton} onPress={() => changeStatus(client)}>
                            <Text style={styles.statusButtonText}>
                              {client.estado === 'activo' ? 'Inactivar' : 'Activar'}
                            </Text>
                          </Pressable>
                          <Pressable style={styles.deleteButton} onPress={() => requestDelete(client)}>
                            <Text style={styles.deleteButtonText}>Eliminar</Text>
                          </Pressable>
                        </>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Estilos del módulo Cliente.
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7F5' },
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7F5',
  },
  introCard: { backgroundColor: '#13795B', borderRadius: 20, padding: 24, marginBottom: 20 },
  introTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '900' },
  introText: { color: '#EAF8F2', fontSize: 16, lineHeight: 23, marginTop: 8 },
  message: { borderRadius: 12, padding: 14, marginBottom: 16 },
  success: { backgroundColor: '#E6F6ED' },
  error: { backgroundColor: '#FDECEC' },
  successText: { color: '#1E6B42', fontSize: 15, fontWeight: '700' },
  errorText: { color: '#B42318', fontSize: 15, fontWeight: '700' },
  centerContent: { alignItems: 'center', justifyContent: 'center', paddingVertical: 70 },
  loadingText: { color: '#647D75', fontSize: 15, marginTop: 12 },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE7E2',
    borderRadius: 18,
    padding: 34,
  },
  emptyTitle: { color: '#173B32', fontSize: 19, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#647D75', fontSize: 15, lineHeight: 21, marginTop: 7, textAlign: 'center' },
  list: { gap: 14 },
  countText: { color: '#647D75', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  clientCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE7E2',
    borderRadius: 17,
    padding: 20,
    gap: 14,
  },
  clientHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  clientInfo: { flex: 1, gap: 4 },
  statusLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  activeText: { color: '#1E6B42' },
  inactiveText: { color: '#B42318' },
  clientName: { color: '#173B32', fontSize: 20, fontWeight: '900' },
  email: { color: '#647D75', fontSize: 15 },
  purchaseBadge: { alignItems: 'center', backgroundColor: '#EAF4F0', borderRadius: 12, padding: 10 },
  purchaseNumber: { color: '#13795B', fontSize: 19, fontWeight: '900' },
  purchaseText: { color: '#647D75', fontSize: 12 },
  date: { color: '#6A7E77', fontSize: 14 },
  editForm: { borderTopWidth: 1, borderTopColor: '#DCE7E2', paddingTop: 15 },
  label: { color: '#173B32', fontSize: 14, fontWeight: '800', marginBottom: 7 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#D7E7E1',
    borderRadius: 11,
    paddingHorizontal: 13,
    color: '#173B32',
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    marginBottom: 14,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  actionsWrap: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 9 },
  primaryButton: {
    minWidth: 105,
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: '#13795B',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#91BEAF',
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: { color: '#13795B', fontSize: 14, fontWeight: '800' },
  statusButton: {
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C19B3A',
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFF9E8',
  },
  statusButtonText: { color: '#7A5A00', fontSize: 14, fontWeight: '800' },
  deleteButton: {
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D05A5A',
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  deleteButtonText: { color: '#B42318', fontSize: 14, fontWeight: '800' },
  deleteConfirmation: { backgroundColor: '#FFF1F0', borderRadius: 12, padding: 15 },
  confirmTitle: { color: '#8F1D14', fontSize: 16, fontWeight: '900' },
  confirmText: { color: '#8F1D14', fontSize: 14, lineHeight: 20, marginTop: 5 },
  deleteConfirmButton: {
    minWidth: 112,
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: '#B42318',
  },
  deleteConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
