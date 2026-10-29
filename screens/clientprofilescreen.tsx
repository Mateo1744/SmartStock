/**
 * RESUMEN DEL ARCHIVO
 * Solicita nombre y apellido la primera vez que ingresa un cliente aprobado.
 * Con esos datos crea el registro clientes asociado a Supabase Auth.
 */

// Hooks para ejecutar la comprobación inicial y manejar el formulario.
import { useEffect, useState } from 'react';
// Navegación entre perfil e inicio.
import { router } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Consulta el usuario que tiene la sesión activa.
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';

export default function ClientProfileScreen() {
  const { user, loading: authLoading } = useAuth();
  // Estados del formulario y sus indicadores.
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Comprueba que la pantalla solo se use para un cliente sin perfil.
  useEffect(() => {
    // Evita cambiar el estado si el componente ya se cerró.
    let isActive = true;

    // Revisa sesión, rol y existencia del registro Cliente.
    async function checkProfile() {
      if (authLoading) {
        return;
      }

      // Administradores o sesiones inválidas vuelven al inicio.
      if (!user || user.rol !== 'cliente') {
        router.replace('/home');
        return;
      }

      const { data: existingProfile, error: profileError } = await supabase
        .from('clientes')
        .select('id')
        .eq('id_usuario', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!isActive) {
        return;
      }

      // Si ya existe, no es necesario volver a mostrar el formulario.
      if (existingProfile) {
        router.replace('/home');
        return;
      }

      setCheckingProfile(false);
    }

    checkProfile().catch(() => {
      if (isActive) {
        setError('No fue posible verificar el perfil. Inténtalo nuevamente.');
        setCheckingProfile(false);
      }
    });

    // Limpieza del efecto cuando se abandona la pantalla.
    return () => {
      isActive = false;
    };
  }, [authLoading, user]);

  // Valida y guarda los datos personales.
  async function handleSave() {
    // trim elimina espacios al principio y al final.
    const cleanName = name.trim();
    const cleanLastName = lastName.trim();
    setError('');

    // Nombre y apellido deben tener contenido válido.
    if (cleanName.length < 2 || cleanLastName.length < 2) {
      setError('Escribe un nombre y un apellido válidos.');
      return;
    }

    if (!user || user.rol !== 'cliente') {
      setError('No se encontró una sesión de cliente válida.');
      return;
    }

    try {
      setSaving(true);

      const { data: existingProfile, error: profileError } = await supabase
        .from('clientes')
        .select('id')
        .eq('id_usuario', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!existingProfile) {
        const { error: insertError } = await supabase.from('clientes').insert({
          id_usuario: user.id,
          nombre: cleanName,
          apellido: cleanLastName,
        });

        if (insertError) throw insertError;
      }

      // Continúa al menú principal después de guardar.
      router.replace('/home');
    } catch {
      setError('No fue posible guardar el perfil. Verifica los datos e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  // Muestra carga mientras se valida el acceso a esta pantalla.
  if (authLoading || checkingProfile || !user || user.rol !== 'cliente') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#13795B" />
      </View>
    );
  }

  // Interfaz que solicita los dos datos faltantes.
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.introCard}>
            <Text style={styles.stepLabel}>ÚLTIMO PASO</Text>
            <Text style={styles.title}>Completa tu perfil</Text>
            <Text style={styles.subtitle}>
              Necesitamos tus datos personales antes de continuar como cliente.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Correo electrónico</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>{user.correo}</Text>
            </View>

            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ejemplo: Mateo"
              placeholderTextColor="#71847D"
              autoCapitalize="words"
              editable={!saving}
            />

            <Text style={styles.label}>Apellido</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Ejemplo: Naranjo"
              placeholderTextColor="#71847D"
              autoCapitalize="words"
              editable={!saving}
              onSubmitEditing={handleSave}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.buttonPressed,
                saving && styles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Guardar y continuar</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Estilos visuales de la pantalla de perfil.
const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F4F7F5' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7F5',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 660,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  introCard: {
    backgroundColor: '#13795B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  stepLabel: { color: '#BDE4D6', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', marginTop: 7 },
  subtitle: { color: '#EAF8F2', fontSize: 16, lineHeight: 23, marginTop: 7 },
  form: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#DCE7E2',
    padding: 24,
  },
  label: { color: '#173B32', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D7E7E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#173B32',
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    marginBottom: 18,
  },
  readOnlyInput: {
    minHeight: 52,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D7E7E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#EAF4F0',
    marginBottom: 18,
  },
  readOnlyText: { color: '#647D75', fontSize: 16 },
  errorText: {
    color: '#B42318',
    backgroundColor: '#FFF1F0',
    borderRadius: 10,
    padding: 12,
    lineHeight: 20,
    marginBottom: 16,
  },
  saveButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#13795B',
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.65 },
});
