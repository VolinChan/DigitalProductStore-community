'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { LoadingOutlined } from '@ant-design/icons';
import apiClient from '@/lib/api';
import TransferPayment from '@/components/checkout/TransferPayment';
import type { ShippingAdjustment, TransferPaymentConfig } from '@/types';

export default function ShippingAdjustmentPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id); const [data, setData] = useState<{ adjustment: ShippingAdjustment; order_number: string }>(); const [accounts, setAccounts] = useState<TransferPaymentConfig['accounts']>([]); const [failed, setFailed] = useState(false); const [purchaseEmail, setPurchaseEmail] = useState('');
  const load = (email: string) => Promise.all([apiClient.get(`/shipping-adjustments/${id}`, { params: email ? { purchase_email: email } : undefined }), apiClient.get('/store-config/transfer-payment')]).then(([adjustmentResponse, accountResponse]) => {
    const next = adjustmentResponse.data.data; setData(next); setAccounts(accountResponse.data.data?.accounts || []); if (email) { sessionStorage.setItem(`shipping-adjustment-email:${id}`, email); sessionStorage.setItem(`transfer-email:${next.adjustment.order_id}`, email); } setFailed(false);
  }).catch(() => setFailed(true));
  useEffect(() => {
    const email = sessionStorage.getItem(`shipping-adjustment-email:${id}`) || ''; setPurchaseEmail(email); void load(email);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (failed) return <main className="store-container"><div className="mx-auto max-w-lg"><h1 className="text-3xl font-black">Consultar diferencia de despacho</h1><p className="mt-3 text-sm text-[var(--sf-muted)]">Ingresa el correo usado en la compra. La respuesta no revela si el ajuste existe.</p><input type="email" value={purchaseEmail} onChange={(event) => setPurchaseEmail(event.target.value)} className="sf-input mt-5 w-full" placeholder="correo@ejemplo.cl" /><button type="button" onClick={() => { setFailed(false); void load(purchaseEmail.trim()); }} className="sf-button-primary mt-4 w-full">Consultar</button></div></main>;
  if (!data) return <main className="store-container flex min-h-[50vh] items-center justify-center"><LoadingOutlined spin className="text-3xl" /></main>;
  const adjustment = data.adjustment;
  return <main className="store-container"><div className="mx-auto max-w-3xl"><h1 className="text-3xl font-black">Diferencia de despacho</h1><div className="mt-5 rounded-[16px] bg-[var(--sf-soft)] p-4"><p><strong>Pedido:</strong> {data.order_number}</p><p><strong>Motivo:</strong> {adjustment.reason || '-'}</p><p><strong>Estado:</strong> {adjustment.status}</p></div>{adjustment.status === 'awaiting_customer_payment' || adjustment.status === 'customer_paid' ? <div className="mt-8"><TransferPayment adjustmentId={adjustment.id} orderId={adjustment.order_id} orderNumber={data.order_number} totalAmount={adjustment.difference_amount || 0} accounts={accounts} /></div> : <p className="mt-8 rounded-[16px] bg-white p-5 font-bold">{adjustment.status === 'confirmed' ? 'El pago del ajuste fue confirmado.' : 'Este ajuste no requiere una acción de pago.'}</p>}</div></main>;
}
