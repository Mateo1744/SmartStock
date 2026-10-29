/**
 * RESUMEN DEL ARCHIVO
 * Lista las cuentas pendientes para que un administrador seleccione su rol
 * y pueda aprobarlas o rechazarlas antes del primer inicio de sesión.
 */

// Hooks para estados y recarga automática de la lista.
import { useCallback, useEffect, useState } from 'react';
// Navegación y evento de enfoque de Expo Router.
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

// Permite comprobar que la persona conectada sea administradora.
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';

// Datos necesarios para representar una solicitud.
type PendingRequest = {
  id: string;
  correo: string;
  fecha_creacion: string;
};

type Message = {
  type: 'success' | 'error';
  text: string;
};

// Roles que el administrador puede asignar.
type UserRole = 'admin' | 'cliente';

// Presenta la fecha de creación en formato colombiano.
function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function PendingRequestsScreen() {
  // Dependencias principales y estado visual.
  const { user, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, UserRole>>({});
  const [message, setMessage] = useState<Message | null>(null);

  // Consulta únicamente cuentas cliente que todavía estén pendientes.
  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const { data: rows, error } = await supabase
        .from('perfiles')
        .select('id, correo, fecha_creacion')
        .eq('rol', 'cliente')
        .eq('estado', 'pendiente')
        .order('fecha_creacion', { ascending: true })
        .order('id', { ascending: true });

      if (error) throw error;
      setRequests(rows);
      // Asigna Cliente como opción inicial sin borrar selecciones existentes.
      setSelectedRoles((current) => {
        const next = { ...current };
        rows.forEach((request) => {
          next[request.id] = next[request.id] ?? 'cliente';
        });
        return next;
      });
    } catch {
      setMessage({ type: 'error', text: 'No fue posible cargar las solicitudes.' });
    } finally {
      setLoading(false);
    }
  }, []);

  // Bloquea la pantalla para usuarios que no sean administradores.
  useEffect(() => {
    if (!authLoading && (!user || user.rol !== 'admin')) {
      router.replace('/home');
    }
  }, [authLoading, user]);

  // Actualiza las solicitudes cada vez que se vuelve al módulo.
  useFocusEffect(
    useCallback(() => {
      if (user?.rol === 'admin') {
        loadRequests();
      }
    }, [loadRequests, user?.rol])
  );

  // Aprueba con el rol seleccionado o rechaza dejando la cuenta inactiva.
  async function changeStatus(request: PendingRequest, status: 'activo' | 'inactivo') {
    try {
      setProcessingId(request.id);
      setMessage(null);

      // Si no hubo selección explícita, el rol seguro por defecto es cliente.
      const selectedRole = selectedRoles[request.id] ?? 'cliente';
      const roleToSave = status === 'activo' ? selectedRole : 'cliente';
      const { data: updatedRows, error } = await supabase
        .from('perfiles')
        .update({ estado: status, rol: roleToSave })
        .eq('id', request.id)
        .eq('rol', 'cliente')
        .eq('estado', 'pendiente')
        .select('id');

      if (error) throw error;

      // Cero cambios significa que la solicitud ya fue procesada.
      if (updatedRows.length === 0) {
        setMessage({
          type: 'error',
          text: 'La solicitud ya había sido procesada. Se actualizará la lista.',
        });
      } else {
        setMessage({
          type: 'success',
          text:
            status === 'activo'
              ? `La cuenta ${request.correo} fue aprobada con rol ${selectedRole}.`
              : `La solicitud de ${request.correo} fue rechazada.`,
        });
      }

      await loadRequests();
    } catch {
      setMessage({ type: 'error', text: 'No fue posible actualizar la solicitud.' });
    } finally {
      setProcessingId(null);
    }
  }

  // Mientras se verifica el rol, no se muestra información sensible.
  if (authLoading || !user || user.rol !== 'admin') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#13795B" />
      </View>
    );
  }

  // Interfaz de solicitudes, selector de rol y botones de decisión.
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Solicitudes de acceso</Text>
          <Text style={styles.introText}>
            Revisa las cuentas nuevas. Al aprobarlas, los usuarios podrán iniciar sesión.
          </Text>
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
            <ActivityIndicator size="large" color="#13795B" />
            <Text style={styles.loadingText}>Cargando solicitudes...</Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No hay solicitudes pendientes</Text>
            <Text style={styles.emptyText}>Las cuentas nuevas aparecerán en esta sección.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            <Text style={styles.countText}>
              {requests.length} {requests.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}
            </Text>

            {requests.map((request) => {
              const isProcessing = processingId === request.id;

              return (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestInfo}>
                    <Text style={styles.pendingLabel}>PENDIENTE</Text>
                    <Text style={styles.email}>{request.correo}</Text>
                    <Text style={styles.date}>Enviada: {formatDate(request.fecha_creacion)}</Text>
                  </View>

                  <View style={styles.roleSection}>
                    <Text style={styles.roleTitle}>Rol que tendrá la cuenta</Text>
                    <View style={styles.roleOptions}>
                      {(['cliente', 'admin'] as UserRole[]).map((role) => {
                        const isSelected = (selectedRoles[request.id] ?? 'cliente') === role;
                        return (
                          <Pressable
                            key={role}
                            style={[styles.roleOption, isSelected && styles.roleOptionSelected]}
                            onPress={() =>
                              setSelectedRoles((current) => ({ ...current, [request.id]: role }))
                            }
                            disabled={processingId !== null}>
                            <Text
                              style={[
                                styles.roleOptionText,
                                isSelected && styles.roleOptionTextSelected,
                              ]}>
                              {role === 'cliente' ? 'Cliente' : 'Administrador'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.actions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.rejectButton,
                        pressed && styles.buttonPressed,
                        isProcessing && styles.buttonDisabled,
                      ]}
                      onPress={() => changeStatus(request, 'inactivo')}
                      disabled={processingId !== null}>
                      <Text style={styles.rejectText}>Rechazar</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [
                        styles.approveButton,
                        pressed && styles.buttonPressed,
                        isProcessing && styles.buttonDisabled,
                      ]}
                      onPress={() => changeStatus(request, 'activo')}
                      disabled={processingId !== null}>
                      {isProcessing ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.approveText}>Aprobar</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Estilos del módulo de aprobación.
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7F5' },
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 820,
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
  introCard: {
    backgroundColor: '#13795B',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
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
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE7E2',
    borderRadius: 17,
    padding: 20,
    gap: 18,
  },
  requestInfo: { gap: 5 },
  pendingLabel: { color: '#9A6700', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  email: { color: '#173B32', fontSize: 18, fontWeight: '800' },
  date: { color: '#6A7E77', fontSize: 14 },
  roleSection: { borderTopWidth: 1, borderTopColor: '#DCE7E2', paddingTop: 14 },
  roleTitle: { color: '#173B32', fontSize: 14, fontWeight: '800', marginBottom: 9 },
  roleOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  roleOption: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#91BEAF',
    borderRadius: 10,
    paddingHorizontal: 15,
    backgroundColor: '#FFFFFF',
  },
  roleOptionSelected: { borderColor: '#13795B', backgroundColor: '#EAF4F0' },
  roleOptionText: { color: '#647D75', fontSize: 14, fontWeight: '800' },
  roleOptionTextSelected: { color: '#13795B' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  rejectButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D05A5A',
    borderRadius: 11,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
  },
  rejectText: { color: '#B42318', fontSize: 15, fontWeight: '800' },
  approveButton: {
    minWidth: 112,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    paddingHorizontal: 18,
    backgroundColor: '#13795B',
  },
  approveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  buttonPressed: { opacity: 0.75 },
  buttonDisabled: { opacity: 0.55 },
});
