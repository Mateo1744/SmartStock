import { router, type Href } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth, type UserRole } from '@/context/auth-context';

type MenuItem = {
  code: string;
  label: string;
  description: string;
  href: Href;
  roles: UserRole[];
};

const MENU_ITEMS: MenuItem[] = [
  {
    code: 'IN',
    label: 'Inicio',
    description: 'Volver al panel principal.',
    href: '/home',
    roles: ['admin', 'cliente'],
  },
  {
    code: 'PR',
    label: 'Productos',
    description: 'Consultar el catálogo y las existencias.',
    href: '/productos',
    roles: ['admin', 'cliente'],
  },
  {
    code: 'CO',
    label: 'Compras',
    description: 'Revisar compras y sus detalles.',
    href: '/encabezados',
    roles: ['admin', 'cliente'],
  },
  {
    code: 'NC',
    label: 'Nueva compra',
    description: 'Registrar una compra de productos.',
    href: '/nueva-compra',
    roles: ['cliente'],
  },
  {
    code: 'CL',
    label: 'Clientes',
    description: 'Administrar cuentas y perfiles de clientes.',
    href: '/clientes',
    roles: ['admin'],
  },
  {
    code: 'SO',
    label: 'Solicitudes',
    description: 'Aprobar o rechazar cuentas pendientes.',
    href: '/solicitudes',
    roles: ['admin'],
  },
  {
    code: 'ES',
    label: 'Estadísticas',
    description: 'Consultar ventas, ingresos y alertas.',
    href: '/estadisticas',
    roles: ['admin'],
  },
  {
    code: 'MP',
    label: 'Mi perfil',
    description: 'Consultar los datos personales registrados.',
    href: '/clientes',
    roles: ['cliente'],
  },
  {
    code: 'SI',
    label: 'Sobre SmartStock',
    description: 'Conocer el propósito del sistema.',
    href: '/sobre-nosotros',
    roles: ['admin', 'cliente'],
  },
];

export function AppMenuButton() {
  const { user, signOut } = useAuth();
  const [visible, setVisible] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;

  const items = MENU_ITEMS.filter((item) => item.roles.includes(user.rol));

  function navigate(href: Href) {
    setVisible(false);
    router.push(href);
  }

  async function handleSignOut() {
    try {
      setSigningOut(true);
      await signOut();
      setVisible(false);
      router.replace('/login');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityLabel="Abrir menú principal"
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
        <View style={styles.triggerLines}>
          <View style={styles.triggerLine} />
          <View style={styles.triggerLine} />
          <View style={styles.triggerLine} />
        </View>
        <Text style={styles.triggerText}>Menú</Text>
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={visible}>
        <SafeAreaView style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Cerrar menú"
            onPress={() => setVisible(false)}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.headingBlock}>
                <Text style={styles.eyebrow}>
                  {user.rol === 'admin' ? 'PANEL ADMINISTRATIVO' : 'ÁREA DE CLIENTE'}
                </Text>
                <Text style={styles.title}>SmartStock</Text>
              </View>
              <Pressable
                accessibilityLabel="Cerrar menú"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setVisible(false)}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.menuList}
              showsVerticalScrollIndicator={false}>
              {items.map((item) => (
                <Pressable
                  accessibilityRole="button"
                  key={`${user.rol}-${item.code}`}
                  onPress={() => navigate(item.href)}
                  style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
                  <View style={styles.itemCode}>
                    <Text style={styles.itemCodeText}>{item.code}</Text>
                  </View>
                  <View style={styles.itemText}>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                    <Text style={styles.itemDescription}>{item.description}</Text>
                  </View>
                  <Text style={styles.itemArrow}>›</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              disabled={signingOut}
              onPress={handleSignOut}
              style={({ pressed }) => [
                styles.signOutButton,
                pressed && !signingOut && styles.pressed,
              ]}>
              {signingOut ? (
                <ActivityIndicator color="#9A3412" />
              ) : (
                <Text style={styles.signOutText}>Cerrar sesión</Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#B9D3CA',
    borderRadius: 11,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  triggerLines: { width: 16, gap: 3 },
  triggerLine: { height: 2, borderRadius: 1, backgroundColor: '#126B52' },
  triggerText: { color: '#126B52', fontSize: 13, fontWeight: '900' },
  modalRoot: {
    flex: 1,
    alignItems: 'flex-end',
    backgroundColor: 'rgba(8, 30, 25, 0.48)',
  },
  sheet: {
    width: '88%',
    maxWidth: 420,
    height: '100%',
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
    backgroundColor: '#F4F7F5',
    shadowColor: '#071F1A',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 16,
  },
  headingBlock: { flex: 1 },
  eyebrow: { color: '#4C8272', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#173B32', fontSize: 24, fontWeight: '900', marginTop: 4 },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1E0DB',
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
  },
  closeText: { color: '#35574D', fontSize: 28, lineHeight: 30, fontWeight: '500' },
  menuList: { gap: 9, paddingBottom: 14 },
  menuItem: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#DCE7E2',
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  menuItemPressed: { borderColor: '#75AD9B', backgroundColor: '#EAF5F1' },
  itemCode: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#DFF2EB',
  },
  itemCodeText: { color: '#126B52', fontSize: 10, fontWeight: '900' },
  itemText: { flex: 1 },
  itemLabel: { color: '#173B32', fontSize: 15, fontWeight: '900' },
  itemDescription: { color: '#697C75', fontSize: 11, lineHeight: 16, marginTop: 3 },
  itemArrow: { color: '#39806C', fontSize: 27, lineHeight: 29 },
  signOutButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 14,
    marginTop: 'auto',
    backgroundColor: '#FFF7ED',
  },
  signOutText: { color: '#9A3412', fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.7 },
});
