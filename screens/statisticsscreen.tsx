/**
 * RESUMEN DEL ARCHIVO
 * Presenta estadísticas calculadas con la información guardada en Supabase.
 * Esta pantalla es privada y únicamente puede verla un administrador.
 */

import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';

// Totales generales que aparecen en las tarjetas superiores.
type Summary = {
  compras: number;
  ingresos: number;
  unidades: number;
  clientes: number;
};

// Información agrupada de cada producto vendido.
type TopProduct = {
  id: number;
  nombre: string;
  unidades: number;
  ingresos: number;
};

// Ingresos agrupados por mes para la gráfica de los últimos seis meses.
type MonthlyIncome = {
  key: string;
  label: string;
  ingresos: number;
};

// Productos que necesitan revisión por tener cinco unidades o menos.
type LowStockProduct = {
  id: number;
  nombre: string;
  stock: number;
};

// Formatea cantidades de dinero como pesos colombianos.
function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

// Abrevia valores para que puedan leerse encima de las barras verticales.
function formatCompactMoney(value: number) {
  if (value >= 1_000_000) {
    return `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value / 1_000_000)} M`;
  }

  if (value >= 1_000) {
    return `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value / 1_000)} mil`;
  }

  return `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value)}`;
}

// Prepara siempre seis meses, incluso si alguno todavía no tiene ventas.
function getLastSixMonths(): MonthlyIncome[] {
  const today = new Date();

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - 5 + index, 1);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const label = new Intl.DateTimeFormat('es-CO', { month: 'short' })
      .format(date)
      .replace('.', '');

    return {
      key: `${date.getFullYear()}-${month}`,
      label,
      ingresos: 0,
    };
  });
}

export default function StatisticsScreen() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<Summary>({
    compras: 0,
    ingresos: 0,
    unidades: 0,
    clientes: 0,
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState<MonthlyIncome[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Consulta nuevamente los indicadores cada vez que se entra a la pantalla.
  const loadStatistics = useCallback(async () => {
    if (user?.rol !== 'admin') {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [headersResult, detailsResult, productsResult] = await Promise.all([
        supabase.from('encabezados').select('id, id_cliente, fecha, total'),
        supabase.from('detalles').select('id_producto, cantidad, valor'),
        supabase
          .from('productos')
          .select('id, nombre, stock')
          .order('stock', { ascending: true })
          .order('nombre', { ascending: true }),
      ]);
      if (headersResult.error) throw headersResult.error;
      if (detailsResult.error) throw detailsResult.error;
      if (productsResult.error) throw productsResult.error;

      const headers = headersResult.data;
      const details = detailsResult.data;
      const productsById = new Map(productsResult.data.map((product) => [product.id, product]));

      const ranking = new Map<number, TopProduct>();
      details.forEach((detail) => {
        const product = productsById.get(detail.id_producto);
        if (!product) return;
        const current = ranking.get(product.id) ?? {
          id: product.id,
          nombre: product.nombre,
          unidades: 0,
          ingresos: 0,
        };
        current.unidades += detail.cantidad;
        current.ingresos += Number(detail.valor);
        ranking.set(product.id, current);
      });
      const products = [...ranking.values()]
        .sort((a, b) => b.unidades - a.unidades || b.ingresos - a.ingresos || a.nombre.localeCompare(b.nombre, 'es'))
        .slice(0, 8);

      const months = getLastSixMonths();
      const incomeByMonth = new Map<string, number>();
      headers.forEach((header) => {
        const date = new Date(header.fecha);
        if (Number.isNaN(date.getTime())) return;
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + Number(header.total));
      });
      const completedMonthlyIncome = months.map((month) => ({
        ...month,
        ingresos: incomeByMonth.get(month.key) ?? 0,
      }));

      const lowStock: LowStockProduct[] = productsResult.data.filter((product) => product.stock <= 5);

      setSummary({
        compras: headers.length,
        ingresos: headers.reduce((sum, header) => sum + Number(header.total), 0),
        clientes: new Set(headers.map((header) => header.id_cliente)).size,
        unidades: details.reduce((sum, detail) => sum + detail.cantidad, 0),
      });
      setTopProducts(products);
      setMonthlyIncome(completedMonthlyIncome);
      setLowStockProducts(lowStock);
    } catch {
      setError('No fue posible calcular las estadísticas. Inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [user?.rol]);

  // Protege la ruta para que solo el administrador pueda consultarla.
  useEffect(() => {
    if (!authLoading && (!user || user.rol !== 'admin')) {
      router.replace(user ? '/home' : '/login');
    }
  }, [authLoading, user]);

  useFocusEffect(
    useCallback(() => {
      if (user?.rol === 'admin') {
        loadStatistics();
      }
    }, [loadStatistics, user?.rol])
  );

  if (authLoading || !user || user.rol !== 'admin') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#13795B" />
      </View>
    );
  }

  // La mayor cantidad sirve como referencia para el ancho de las barras.
  const maximumUnits = Math.max(...topProducts.map((product) => product.unidades), 1);
  // El ingreso más alto define la escala común de las seis barras mensuales.
  const maximumMonthlyIncome = Math.max(...monthlyIncome.map((month) => month.ingresos), 1);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>PANEL ADMINISTRATIVO</Text>
          <Text style={styles.heroTitle}>Estadísticas</Text>
          <Text style={styles.heroText}>
            Consulta el comportamiento de las ventas y el estado actual del inventario.
          </Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? (
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#13795B" />
            <Text style={styles.loadingText}>Calculando estadísticas...</Text>
          </View>
        ) : (
          <>
            {/* Indicadores generales del negocio. */}
            <View style={styles.summaryGrid}>
              <SummaryCard label="Compras realizadas" value={String(summary.compras)} />
              <SummaryCard label="Ingresos totales" value={formatMoney(summary.ingresos)} />
              <SummaryCard label="Unidades vendidas" value={String(summary.unidades)} />
              <SummaryCard label="Clientes compradores" value={String(summary.clientes)} />
            </View>

            {/* Ranking de productos ordenado por unidades vendidas. */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Productos más vendidos</Text>
              <Text style={styles.sectionDescription}>
                El ranking se calcula con las cantidades guardadas en los detalles de compra.
              </Text>

              {topProducts.length === 0 ? (
                <Text style={styles.emptyText}>Todavía no hay ventas para analizar.</Text>
              ) : (
                <View style={styles.rankingList}>
                  {topProducts.map((product, index) => {
                    const percentage = Math.max((product.unidades / maximumUnits) * 100, 4);

                    return (
                      <View key={product.id} style={styles.productRow}>
                        <View style={styles.productHeader}>
                          <Text style={styles.position}>#{index + 1}</Text>
                          <View style={styles.productInformation}>
                            <Text style={styles.productName}>{product.nombre}</Text>
                            <Text style={styles.productMeta}>
                              {product.unidades} {product.unidades === 1 ? 'unidad' : 'unidades'} ·{' '}
                              {formatMoney(product.ingresos)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.barBackground}>
                          <View
                            style={[
                              styles.barFill,
                              { width: `${percentage}%` as `${number}%` },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Ingresos totales de cada uno de los últimos seis meses. */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Ingresos mensuales</Text>
              <Text style={styles.sectionDescription}>
                Compara el total facturado durante los últimos seis meses.
              </Text>

              <View style={styles.monthlyChart}>
                {monthlyIncome.map((month) => {
                  const percentage =
                    month.ingresos > 0
                      ? Math.max((month.ingresos / maximumMonthlyIncome) * 100, 6)
                      : 3;

                  return (
                    <View key={month.key} style={styles.monthColumn}>
                      <Text
                        style={styles.monthValue}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}>
                        {formatCompactMoney(month.ingresos)}
                      </Text>
                      <View style={styles.monthBarTrack}>
                        <View
                          style={[
                            styles.monthBar,
                            month.ingresos === 0 && styles.emptyMonthBar,
                            { height: `${percentage}%` as `${number}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.monthLabel}>{month.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Advertencia administrativa sobre productos que podrían agotarse. */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Productos con poco stock</Text>
              <Text style={styles.sectionDescription}>
                Se muestran los productos que tienen cinco unidades o menos.
              </Text>

              {lowStockProducts.length === 0 ? (
                <Text style={styles.successText}>El inventario no tiene alertas de stock.</Text>
              ) : (
                <View style={styles.stockList}>
                  {lowStockProducts.map((product) => (
                    <View key={product.id} style={styles.stockRow}>
                      <Text style={styles.stockName}>{product.nombre}</Text>
                      <View style={[styles.stockBadge, product.stock === 0 && styles.outOfStockBadge]}>
                        <Text
                          style={[
                            styles.stockValue,
                            product.stock === 0 && styles.outOfStockText,
                          ]}>
                          {product.stock === 0 ? 'Agotado' : `${product.stock} disponibles`}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Tarjeta reutilizable para los cuatro indicadores principales.
function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7F5' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7F5',
  },
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 18,
  },
  heroCard: { backgroundColor: '#13795B', borderRadius: 22, padding: 26 },
  heroLabel: { color: '#BDE4D6', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 7 },
  heroText: { color: '#EAF8F2', fontSize: 16, lineHeight: 23, marginTop: 8 },
  errorText: { color: '#B42318', backgroundColor: '#FFF1F0', borderRadius: 12, padding: 14 },
  loadingContent: { alignItems: 'center', paddingVertical: 70 },
  loadingText: { color: '#647D75', fontSize: 15, marginTop: 12 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  summaryCard: {
    flexGrow: 1,
    flexBasis: 190,
    minHeight: 118,
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE7E2',
    borderRadius: 17,
    padding: 19,
  },
  summaryLabel: { color: '#647D75', fontSize: 14, fontWeight: '700' },
  summaryValue: { color: '#173B32', fontSize: 25, fontWeight: '900', marginTop: 14 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE7E2',
    borderRadius: 18,
    padding: 22,
  },
  sectionTitle: { color: '#173B32', fontSize: 21, fontWeight: '900' },
  sectionDescription: { color: '#647D75', fontSize: 14, lineHeight: 21, marginTop: 6 },
  emptyText: { color: '#6A7E77', fontSize: 15, textAlign: 'center', paddingVertical: 30 },
  successText: {
    color: '#1E6B42',
    backgroundColor: '#E6F6ED',
    borderRadius: 11,
    padding: 14,
    marginTop: 17,
    fontWeight: '700',
  },
  rankingList: { gap: 20, marginTop: 22 },
  productRow: { gap: 10 },
  productHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  position: { color: '#13795B', fontSize: 17, fontWeight: '900', width: 32 },
  productInformation: { flex: 1 },
  productName: { color: '#173B32', fontSize: 16, fontWeight: '800' },
  productMeta: { color: '#647D75', fontSize: 13, marginTop: 3 },
  barBackground: { height: 9, borderRadius: 5, backgroundColor: '#DCE7E2', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5, backgroundColor: '#13795B' },
  monthlyChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    minHeight: 190,
    marginTop: 24,
  },
  monthColumn: { flex: 1, minWidth: 38, alignItems: 'center' },
  monthValue: {
    width: '100%',
    color: '#35574D',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 7,
  },
  monthBarTrack: {
    width: '68%',
    height: 130,
    justifyContent: 'flex-end',
    borderRadius: 8,
    backgroundColor: '#EAF4F0',
    overflow: 'hidden',
  },
  monthBar: { width: '100%', borderRadius: 8, backgroundColor: '#F59E0B' },
  emptyMonthBar: { backgroundColor: '#CCD7DE' },
  monthLabel: {
    color: '#647D75',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
    marginTop: 8,
  },
  stockList: { gap: 10, marginTop: 18 },
  stockRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EAF4F0',
    paddingVertical: 10,
  },
  stockName: { flex: 1, color: '#173B32', fontSize: 15, fontWeight: '800' },
  stockBadge: { backgroundColor: '#FFF5D6', borderRadius: 15, paddingHorizontal: 12, paddingVertical: 7 },
  stockValue: { color: '#7A5A00', fontSize: 12, fontWeight: '900' },
  outOfStockBadge: { backgroundColor: '#FFF1F0' },
  outOfStockText: { color: '#B42318' },
});
