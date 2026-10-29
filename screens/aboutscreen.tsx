/**
 * RESUMEN DEL ARCHIVO
 * Presenta información institucional sobre SmartStock: su origen, propósito,
 * misión, visión, funciones principales y valores.
 */

import { useEffect } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';

export default function AboutScreen() {
  // Consulta la sesión para que este apartado solo sea visible dentro de la aplicación.
  const { user, loading } = useAuth();

  // Si no existe una sesión activa, regresa al inicio de sesión.
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user]);

  // Evita mostrar el contenido mientras se recupera la sesión.
  if (loading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#176B87" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Presentación principal de la aplicación. */}
        <View style={styles.heroCard}>
          <Text style={styles.brandLabel}>SMARTSTOCK</Text>
          <Text style={styles.heroTitle}>Sobre nosotros</Text>
          <Text style={styles.heroText}>
            Una solución sencilla para organizar productos, clientes, existencias y compras desde
            un mismo lugar.
          </Text>
        </View>

        {/* Historia y razón de creación del proyecto. */}
        <View style={styles.mainCard}>
          <Text style={styles.sectionNumber}>01</Text>
          <Text style={styles.sectionTitle}>Nuestra historia</Text>
          <Text style={styles.paragraph}>
            SmartStock nació como un proyecto académico de desarrollo móvil pensado para pequeños
            negocios que necesitan controlar su inventario sin utilizar sistemas complicados. La
            aplicación reúne la información más importante del negocio y reduce los errores que
            aparecen cuando las ventas y existencias se administran manualmente.
          </Text>
        </View>

        <View style={styles.twoColumnContainer}>
          {/* Objetivo actual del proyecto. */}
          <View style={styles.infoCard}>
            <Text style={styles.sectionNumber}>02</Text>
            <Text style={styles.cardTitle}>Nuestra misión</Text>
            <Text style={styles.paragraph}>
              Facilitar el control diario de productos, clientes y compras mediante una herramienta
              clara, rápida y accesible, que permita tomar mejores decisiones sobre el inventario.
            </Text>
          </View>

          {/* Meta que orienta el crecimiento futuro. */}
          <View style={styles.infoCard}>
            <Text style={styles.sectionNumber}>03</Text>
            <Text style={styles.cardTitle}>Nuestra visión</Text>
            <Text style={styles.paragraph}>
              Convertir SmartStock en una solución confiable para la gestión de pequeños negocios,
              incorporando reportes, alertas de stock y nuevas herramientas de análisis.
            </Text>
          </View>
        </View>

        {/* Resumen de los módulos que forman la aplicación. */}
        <View style={styles.mainCard}>
          <Text style={styles.sectionNumber}>04</Text>
          <Text style={styles.sectionTitle}>¿Qué hacemos?</Text>
          <View style={styles.featureList}>
            <FeatureItem
              title="Gestión de usuarios"
              description="Registro, aprobación de cuentas y acceso según el rol asignado."
            />
            <FeatureItem
              title="Control de inventario"
              description="Creación de productos y seguimiento de precios y existencias."
            />
            <FeatureItem
              title="Registro de compras"
              description="Encabezados, detalles, totales y actualización automática del stock."
            />
            <FeatureItem
              title="Historial confiable"
              description="Conservación de clientes, productos y movimientos relacionados."
            />
          </View>
        </View>

        {/* Valores que resumen el enfoque de SmartStock. */}
        <View style={styles.valuesCard}>
          <Text style={styles.valuesTitle}>Nuestros valores</Text>
          <View style={styles.valueRow}>
            <ValueBadge label="Simplicidad" />
            <ValueBadge label="Organización" />
            <ValueBadge label="Responsabilidad" />
            <ValueBadge label="Confiabilidad" />
          </View>
        </View>

        <Text style={styles.footerText}>
          Desarrollado con Expo, React Native, TypeScript y Supabase.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// Elemento reutilizable para describir una función de la aplicación.
function FeatureItem({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureDot} />
      <View style={styles.featureTextContainer}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

// Etiqueta visual reutilizable para cada valor del proyecto.
function ValueBadge({ label }: { label: string }) {
  return (
    <View style={styles.valueBadge}>
      <Text style={styles.valueText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7FA' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7FA',
  },
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 16,
  },
  heroCard: {
    backgroundColor: '#176B87',
    borderRadius: 22,
    padding: 28,
  },
  brandLabel: { color: '#B8E3EF', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  heroTitle: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', marginTop: 8 },
  heroText: { color: '#E7F5F8', fontSize: 17, lineHeight: 25, marginTop: 10, maxWidth: 680 },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E9EE',
    borderRadius: 18,
    padding: 22,
  },
  twoColumnContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  infoCard: {
    flexGrow: 1,
    flexBasis: 300,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E9EE',
    borderRadius: 18,
    padding: 22,
  },
  sectionNumber: { color: '#176B87', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: '#14324A', fontSize: 23, fontWeight: '900', marginTop: 7 },
  cardTitle: { color: '#14324A', fontSize: 20, fontWeight: '900', marginTop: 7 },
  paragraph: { color: '#5F7181', fontSize: 15, lineHeight: 23, marginTop: 10 },
  featureList: { gap: 16, marginTop: 18 },
  featureItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#176B87', marginTop: 6 },
  featureTextContainer: { flex: 1 },
  featureTitle: { color: '#14324A', fontSize: 16, fontWeight: '800' },
  featureDescription: { color: '#5F7181', fontSize: 14, lineHeight: 21, marginTop: 3 },
  valuesCard: { backgroundColor: '#E8F3F6', borderRadius: 18, padding: 22 },
  valuesTitle: { color: '#14324A', fontSize: 19, fontWeight: '900' },
  valueRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  valueBadge: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 9 },
  valueText: { color: '#176B87', fontSize: 14, fontWeight: '800' },
  footerText: { color: '#6C7F8F', fontSize: 13, textAlign: 'center', marginVertical: 8 },
});
