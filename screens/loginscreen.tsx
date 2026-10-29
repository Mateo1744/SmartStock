/**
 * RESUMEN DEL ARCHIVO
 * Muestra el formulario de inicio de sesión, valida que haya datos y utiliza
 * el contexto de autenticación para permitir o negar el acceso.
 */

// useState conserva lo escrito y el estado del formulario.
import { useState } from 'react';
// router cambia de pantalla después de una acción.
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
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// useAuth entrega la función central de inicio de sesión.
import { useAuth } from '@/context/auth-context';

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  // Obtiene la acción signIn desde el contexto compartido.
  const { signIn } = useAuth();
  // Estados controlados por los campos y la interfaz.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isDesktop = width >= 820;

  // Se ejecuta al presionar el botón o enviar la contraseña.
  async function handleLogin() {
    // Borra mensajes anteriores antes de volver a validar.
    setMessage('');

    // Ambos campos son obligatorios.
    if (!email.trim() || !password) {
      setMessage('Completa el correo y la contraseña.');
      return;
    }

    try {
      // Desactiva el formulario mientras Supabase verifica la cuenta.
      setIsLoading(true);
      const result = await signIn(email, password);

      // Muestra el mensaje específico: credenciales, pendiente o inactiva.
      if (!result.ok) {
        setMessage(result.message);
        return;
      }

      // Reemplaza la ruta para evitar volver al login con el botón Atrás.
      router.replace('/home');
    } catch {
      setMessage('No fue posible iniciar sesión. Inténtalo nuevamente.');
    } finally {
      setIsLoading(false);
    }
  }

  // Interfaz visual del formulario.
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            isDesktop ? styles.containerDesktop : styles.containerMobile,
          ]}
          keyboardShouldPersistTaps="handled">
          <View style={[styles.brandPanel, isDesktop && styles.brandPanelDesktop]}>
            <View style={styles.decorativeCircleLarge} />
            <View style={styles.decorativeCircleSmall} />

            <View style={styles.brandHeader}>
              <View style={styles.brandMark}>
                <Text style={styles.brandInitials}>SS</Text>
              </View>
              <View>
                <Text style={styles.appName}>SmartStock</Text>
                <Text style={styles.brandCaption}>GESTIÓN INTELIGENTE</Text>
              </View>
            </View>

            <View style={[styles.brandMessage, !isDesktop && styles.brandMessageMobile]}>
              <View style={styles.eyebrowRow}>
                <View style={styles.eyebrowLine} />
                <Text style={styles.eyebrow}>CONTROL QUE IMPULSA</Text>
              </View>
              <Text style={[styles.brandTitle, !isDesktop && styles.brandTitleMobile]}>
                Cada producto en su lugar.{isDesktop ? '\n' : ' '}Cada decisión a tiempo.
              </Text>
              <Text style={styles.brandDescription}>
                Inventario, compras y resultados en un solo espacio claro, ágil y confiable.
              </Text>

              <View style={styles.benefitRow}>
                <View style={styles.benefitPill}>
                  <View style={styles.benefitDot} />
                  <Text style={styles.benefitText}>Stock bajo control</Text>
                </View>
                <View style={styles.benefitPill}>
                  <View style={styles.benefitDot} />
                  <Text style={styles.benefitText}>Decisiones con datos</Text>
                </View>
              </View>
            </View>

            {isDesktop ? (
              <Text style={styles.brandFooter}>SmartStock · El control de tu negocio</Text>
            ) : null}
          </View>

          <View style={[styles.formSide, isDesktop && styles.formSideDesktop]}>
            {/* Tarjeta que contiene correo, contraseña y acciones. */}
            <View style={styles.form}>
              <View style={styles.accessBadge}>
                <View style={styles.accessBadgeInner} />
              </View>
              <Text style={styles.title}>Bienvenido de nuevo</Text>
              <Text style={styles.subtitle}>Ingresa tus credenciales para continuar.</Text>

              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#71847D"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!isLoading}
                returnKeyType="next"
              />

              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.passwordField}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#71847D"
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                  onSubmitEditing={handleLogin}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  hitSlop={8}
                  onPress={() => setShowPassword((current) => !current)}
                  style={({ pressed }) => [styles.passwordToggle, pressed && styles.buttonPressed]}>
                  <Text style={styles.passwordToggleText}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
                </Pressable>
              </View>

              {/* El mensaje solo se dibuja cuando existe un error. */}
              {message ? <Text style={styles.errorText}>{message}</Text> : null}

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleLogin}
                disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.primaryButtonText}>Iniciar sesión</Text>
                    <Text style={styles.primaryButtonArrow}>›</Text>
                  </View>
                )}
              </Pressable>

              {/* Acceso al registro para usuarios que todavía no tienen cuenta. */}
              <View style={styles.registerRow}>
                <Text style={styles.registerText}>¿Aún no tienes una cuenta?</Text>
                <Pressable onPress={() => router.push('/register')} disabled={isLoading}>
                  <Text style={styles.registerLink}> Solicítala aquí</Text>
                </Pressable>
              </View>

              <View style={styles.secureNotice}>
                <View style={styles.secureDot} />
                <Text style={styles.secureText}>Acceso protegido para usuarios autorizados</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Estilos de presentación; no contienen lógica del negocio.
const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F4F7F5' },
  container: {
    flexGrow: 1,
  },
  containerDesktop: { flexDirection: 'row', minHeight: 720 },
  containerMobile: { padding: 14, gap: 14 },
  brandPanel: {
    overflow: 'hidden',
    position: 'relative',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: '#0B4338',
  },
  brandPanelDesktop: {
    width: '52%',
    minHeight: 720,
    justifyContent: 'space-between',
    borderRadius: 0,
    paddingHorizontal: 48,
    paddingVertical: 42,
  },
  decorativeCircleLarge: {
    position: 'absolute',
    top: -180,
    right: -140,
    width: 440,
    height: 440,
    borderRadius: 220,
    borderWidth: 70,
    borderColor: 'rgba(41, 167, 119, 0.13)',
  },
  decorativeCircleSmall: {
    position: 'absolute',
    bottom: -70,
    left: -50,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(19, 121, 91, 0.26)',
  },
  brandHeader: { flexDirection: 'row', alignItems: 'center', gap: 13, zIndex: 1 },
  brandMark: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#29A777',
  },
  brandInitials: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  appName: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  brandCaption: { color: '#9BCABC', fontSize: 9, fontWeight: '900', letterSpacing: 1.3, marginTop: 2 },
  brandMessage: { maxWidth: 620, zIndex: 1 },
  brandMessageMobile: { marginTop: 34, marginBottom: 12 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrowLine: { width: 32, height: 3, borderRadius: 2, backgroundColor: '#63D3AE' },
  eyebrow: { color: '#A9E6D2', fontSize: 11, fontWeight: '900', letterSpacing: 1.7 },
  brandTitle: { color: '#FFFFFF', fontSize: 46, lineHeight: 55, fontWeight: '900', marginTop: 22 },
  brandTitleMobile: { fontSize: 30, lineHeight: 37, marginTop: 14 },
  brandDescription: { maxWidth: 560, color: '#CBE1DB', fontSize: 17, lineHeight: 27, marginTop: 18 },
  benefitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 28 },
  benefitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2A655A',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  benefitDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#63D3AE' },
  benefitText: { color: '#D9EDE7', fontSize: 12, fontWeight: '800' },
  brandFooter: { color: '#88B8AA', fontSize: 12, zIndex: 1 },
  formSide: { alignItems: 'center', justifyContent: 'center' },
  formSideDesktop: { flex: 1, paddingHorizontal: 40, paddingVertical: 44 },
  title: {
    color: '#173B32',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 18,
  },
  subtitle: {
    color: '#647D75',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 6,
    marginBottom: 28,
  },
  form: {
    width: '100%',
    maxWidth: 470,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1EBE7',
    borderRadius: 24,
    padding: 28,
    boxShadow: '0 18px 50px rgba(11, 67, 56, 0.10)',
    elevation: 5,
  },
  accessBadge: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#E1F4EC',
  },
  accessBadgeInner: {
    width: 18,
    height: 18,
    borderWidth: 5,
    borderColor: '#13795B',
    borderRadius: 6,
  },
  label: {
    color: '#173B32',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D7E7E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#173B32',
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    marginBottom: 17,
  },
  passwordField: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D7E7E1',
    borderRadius: 12,
    marginBottom: 17,
    backgroundColor: '#FFFFFF',
  },
  passwordInput: { flex: 1, minHeight: 50, paddingHorizontal: 14, color: '#173B32', fontSize: 16 },
  passwordToggle: { paddingHorizontal: 13, paddingVertical: 12 },
  passwordToggleText: { color: '#13795B', fontSize: 12, fontWeight: '900' },
  errorText: {
    color: '#B42318',
    backgroundColor: '#FFF1F0',
    borderRadius: 10,
    padding: 12,
    lineHeight: 20,
    marginBottom: 16,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#13795B',
  },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  primaryButtonArrow: { color: '#FFFFFF', fontSize: 23, lineHeight: 23 },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.65 },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 22,
  },
  registerText: { color: '#647D75', fontSize: 15 },
  registerLink: { color: '#13795B', fontSize: 15, fontWeight: '800' },
  secureNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: '#E7EFEC',
    marginTop: 22,
    paddingTop: 18,
  },
  secureDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#29A777' },
  secureText: { color: '#71847D', fontSize: 11 },
});
