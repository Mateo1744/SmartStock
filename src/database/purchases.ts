/**
 * Operaciones atómicas de compra expuestas por PostgreSQL mediante RPC.
 * El servidor valida permisos, stock y totales dentro de una transacción.
 */

import { supabase } from '@/lib/supabase';

export type PurchaseItemInput = {
  productId: number;
  quantity: number;
};

function messageFromRpc(error: { message: string }) {
  return new Error(error.message || 'No fue posible completar la operación.');
}

export async function createPurchase(clientId: number, items: PurchaseItemInput[]) {
  if (items.length === 0) throw new Error('Selecciona al menos un producto.');

  const { data, error } = await supabase.rpc('crear_compra', {
    p_items: items,
    p_cliente_id: clientId,
  });
  if (error) throw messageFromRpc(error);
  return data;
}

export async function deletePurchase(purchaseId: number) {
  const { error } = await supabase.rpc('eliminar_compra', { p_compra_id: purchaseId });
  if (error) throw messageFromRpc(error);
}

export async function updateDetailQuantity(detailId: number, newQuantity: number) {
  if (!Number.isInteger(newQuantity) || newQuantity <= 0) {
    throw new Error('La cantidad debe ser un número entero mayor que cero.');
  }

  const { error } = await supabase.rpc('actualizar_cantidad_detalle', {
    p_detalle_id: detailId,
    p_nueva_cantidad: newQuantity,
  });
  if (error) throw messageFromRpc(error);
}

export async function addPurchaseDetail(
  purchaseId: number,
  productId: number,
  quantity: number
) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('La cantidad debe ser un número entero mayor que cero.');
  }

  const { error } = await supabase.rpc('agregar_detalle_compra', {
    p_compra_id: purchaseId,
    p_producto_id: productId,
    p_cantidad: quantity,
  });
  if (error) throw messageFromRpc(error);
}

export async function deletePurchaseDetail(detailId: number) {
  const { error } = await supabase.rpc('eliminar_detalle_compra', {
    p_detalle_id: detailId,
  });
  if (error) throw messageFromRpc(error);
}
