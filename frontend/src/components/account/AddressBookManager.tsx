'use client';

import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, message } from 'antd';
import { CheckCircleFilled, DeleteOutlined, EditOutlined, EnvironmentOutlined, PhoneOutlined, PlusOutlined, StarOutlined, UserOutlined } from '@ant-design/icons';
import { useLocale } from 'next-intl';
import apiClient from '@/lib/api';
import type { ChileCommune, ChileRegion, UserAddress } from '@/types';

export default function AddressBookManager() {
  const locale = useLocale(); const es = locale !== 'en';
  const [rows, setRows] = useState<UserAddress[]>([]); const [regions, setRegions] = useState<ChileRegion[]>([]); const [communes, setCommunes] = useState<ChileCommune[]>([]);
  const [editing, setEditing] = useState<UserAddress | null | undefined>(undefined); const [form] = Form.useForm(); const regionID = Form.useWatch('region_id', form);
  const load = async () => { const [addressResponse, regionResponse] = await Promise.all([apiClient.get('/me/addresses'), apiClient.get('/locations/regions')]); setRows(addressResponse.data.data || []); setRegions(regionResponse.data.data || []); };
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!regionID) { setCommunes([]); return; } void apiClient.get(`/locations/regions/${regionID}/communes`).then((response) => setCommunes(response.data.data || [])); }, [regionID]);
  const open = (row?: UserAddress) => { form.resetFields(); setEditing(row || null); form.setFieldsValue(row || { is_default: rows.length === 0 }); };
  const save = async () => { const values = await form.validateFields(); if (editing?.id) await apiClient.put(`/me/addresses/${editing.id}`, values); else await apiClient.post('/me/addresses', values); setEditing(undefined); form.resetFields(); await load(); message.success(es ? 'Dirección guardada' : 'Address saved'); };
  const remove = async (id: number) => { await apiClient.delete(`/me/addresses/${id}`); await load(); };
  const makeDefault = async (id: number) => { await apiClient.post(`/me/addresses/${id}/default`); await load(); };
  return <section className="mt-12 overflow-hidden rounded-[28px] border border-solid border-[var(--sf-line)] bg-[var(--sf-soft)]" aria-labelledby="address-book-title">
    <header className="flex flex-wrap items-center justify-between gap-5 border-0 border-b border-solid border-[var(--sf-line)] bg-white/75 p-5 sm:p-7">
      <div className="flex min-w-0 items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--sf-brand)] text-xl text-white"><EnvironmentOutlined /></span>
        <div>
          <div className="flex flex-wrap items-center gap-2.5"><h2 id="address-book-title" className="text-xl font-black text-[var(--sf-ink)]">{es ? 'Mis direcciones' : 'My addresses'}</h2><span className="rounded-full bg-[var(--sf-soft-blue)] px-2.5 py-1 text-xs font-bold text-[var(--sf-brand)]">{rows.length}</span></div>
          <p className="mt-1.5 max-w-md text-sm leading-6 text-[var(--sf-muted)]">{es ? 'Guarda tus destinos y elige dónde recibir tu próximo pedido.' : 'Keep your delivery details ready for your next order.'}</p>
        </div>
      </div>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>{es ? 'Agregar dirección' : 'Add address'}</Button>
    </header>
    <div className="p-4 sm:p-6">
      {rows.length === 0 ? <div className="rounded-[20px] border border-dashed border-[var(--sf-line)] bg-white/70 px-5 py-10 text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--sf-soft-blue)] text-3xl text-[var(--sf-accent)]"><EnvironmentOutlined /></span><h3 className="mt-4 text-lg font-black text-[var(--sf-ink)]">{es ? 'Tu próximo destino empieza aquí' : 'Ready for your next delivery'}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--sf-muted)]">{es ? 'Agrega una dirección para completar tus próximas compras más rápido.' : 'Add an address to make your next checkout a little quicker.'}</p></div>
        : <div className="grid gap-4 md:grid-cols-2">{[...rows].sort((a, b) => Number(b.is_default) - Number(a.is_default)).map((row) => (
          <article key={row.id} className={`flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-solid bg-white shadow-[0_4px_16px_rgba(23,63,103,0.035)] ${row.is_default ? 'border-[var(--sf-accent)]/40' : 'border-[var(--sf-line)]'}`}>
            <div className={`h-1 ${row.is_default ? 'bg-[var(--sf-accent)]' : 'bg-[var(--sf-line)]'}`} />
            <div className="flex-1 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="min-w-0 break-words text-base font-black text-[var(--sf-ink)]">{row.label || (es ? 'Dirección de entrega' : 'Delivery address')}</h3>
                {row.is_default && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e4f3e9] px-2.5 py-1 text-xs font-bold text-[var(--sf-success)]"><CheckCircleFilled />{es ? 'Predeterminada' : 'Default'}</span>}
              </div>
              <div className="mt-5 flex items-start gap-3">
                <EnvironmentOutlined className="mt-1 text-lg text-[var(--sf-accent)]" />
                <div className="min-w-0"><p className="break-words text-base font-bold leading-6 text-[var(--sf-ink)]">{row.street} {row.street_number}</p>{row.complement && <p className="mt-1 break-words text-sm leading-6 text-[var(--sf-subtle)]">{row.complement}</p>}<p className="mt-1 text-sm leading-6 text-[var(--sf-muted)]">{[row.commune?.name, row.region?.name].filter(Boolean).join(' · ')}</p></div>
              </div>
              <div className="mt-5 space-y-2 border-0 border-t border-solid border-[var(--sf-line)] pt-4 text-sm text-[var(--sf-subtle)]">
                <p className="flex items-start gap-2.5"><UserOutlined className="mt-1 text-[var(--sf-muted)]" /><span className="min-w-0 break-words">{row.recipient}</span></p>
                {row.phone && <p className="flex items-center gap-2.5"><PhoneOutlined className="text-[var(--sf-muted)]" /><span>{row.phone}</span></p>}
              </div>
            </div>
            <footer className="flex flex-wrap items-center gap-2 border-0 border-t border-solid border-[var(--sf-line)] bg-[var(--sf-bg)] px-4 py-3">
              <Button size="small" icon={<EditOutlined />} onClick={() => open(row)}>{es ? 'Editar' : 'Edit'}</Button>
              {!row.is_default && <Button size="small" type="text" icon={<StarOutlined />} onClick={() => void makeDefault(row.id)}>{es ? 'Usar por defecto' : 'Make default'}</Button>}
              <Button className="ml-auto" danger type="text" size="small" icon={<DeleteOutlined />} aria-label={es ? 'Eliminar dirección' : 'Delete address'} title={es ? 'Eliminar dirección' : 'Delete address'} onClick={() => void remove(row.id)} />
            </footer>
          </article>
        ))}</div>}
      <p className="mt-4 px-1 text-xs leading-5 text-[var(--sf-muted)]">{es ? 'Solo tú puedes ver y administrar estas direcciones.' : 'Only you can view and manage these addresses.'}</p>
    </div>
    <Modal centered styles={{ body: { maxHeight: '60dvh', overflowY: 'auto', paddingRight: 4 } }} okText={es ? 'Guardar dirección' : 'Save address'} cancelText={es ? 'Cancelar' : 'Cancel'} open={editing !== undefined} title={editing?.id ? (es ? 'Editar dirección' : 'Edit address') : (es ? 'Nueva dirección' : 'New address')} onCancel={() => setEditing(undefined)} onOk={() => void save()} destroyOnHidden><Form form={form} layout="vertical"><div className="grid gap-x-3 sm:grid-cols-2"><Form.Item name="label" label={es ? 'Etiqueta' : 'Label'}><Input /></Form.Item><Form.Item name="recipient" label={es ? 'Destinatario' : 'Recipient'} rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="phone" label={es ? 'Teléfono' : 'Phone'} rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="region_id" label={es ? 'Región' : 'Region'} rules={[{ required: true }]}><Select onChange={() => form.setFieldValue('commune_id', undefined)} options={regions.map((row) => ({ value: row.id, label: row.name }))} /></Form.Item><Form.Item name="commune_id" label={es ? 'Comuna' : 'Commune'} rules={[{ required: true }]}><Select options={communes.map((row) => ({ value: row.id, label: row.name }))} /></Form.Item><Form.Item name="street" label={es ? 'Calle' : 'Street'} rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="street_number" label={es ? 'Número' : 'Number'} rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="complement" label={es ? 'Complemento' : 'Complement'}><Input /></Form.Item><Form.Item name="reference" label={es ? 'Referencia' : 'Reference'}><Input /></Form.Item></div></Form></Modal>
  </section>;
}
