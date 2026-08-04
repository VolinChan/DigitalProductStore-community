'use client';

import { useEffect, useState } from 'react';
import { Button, Checkbox, Form, Input, Select } from 'antd';
import { MailOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import apiClient from '@/lib/api';
import type { ChileCommune, ChileRegion, UserAddress } from '@/types';

export interface ShippingInfo {
  full_name: string; email: string; phone: string; address_source: 'existing' | 'new'; address_id?: number;
  region_id: number; commune_id: number; street: string; street_number: string; complement?: string; reference?: string; remember_address?: boolean;
}
interface ShippingFormProps { form: ReturnType<typeof Form.useForm>[0]; initialValues?: Partial<ShippingInfo>; authenticated?: boolean }

const guestAddressKey = 'plexoria:guest-address:v1';

export default function ShippingForm({ form, initialValues, authenticated = false }: ShippingFormProps) {
  const t = useTranslations();
  const [regions, setRegions] = useState<ChileRegion[]>([]);
  const [communes, setCommunes] = useState<ChileCommune[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const regionID = Form.useWatch('region_id', form);
  const source = Form.useWatch('address_source', form) || 'new';

  useEffect(() => {
    void apiClient.get('/locations/regions').then((response) => setRegions(response.data.data || []));
    if (authenticated) void apiClient.get('/me/addresses').then((response) => {
      const rows = response.data.data || []; setAddresses(rows);
      const preferred = rows.find((row: UserAddress) => row.is_default) || rows[0];
      if (preferred) selectAddress(preferred);
    });
    else if (typeof window !== 'undefined') {
      try { const saved = JSON.parse(localStorage.getItem(guestAddressKey) || 'null'); if (saved?.version === 1) form.setFieldsValue({ ...saved.address, address_source: 'new', remember_address: true }); } catch { /* ignore invalid browser state */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  useEffect(() => {
    if (!regionID) { setCommunes([]); return; }
    void apiClient.get(`/locations/regions/${regionID}/communes`).then((response) => setCommunes(response.data.data || []));
  }, [regionID]);

  const selectAddress = (address: UserAddress) => {
    form.setFieldsValue({ address_source: 'existing', address_id: address.id, full_name: address.recipient, phone: address.phone, region_id: address.region_id, commune_id: address.commune_id, street: address.street, street_number: address.street_number, complement: address.complement, reference: address.reference });
  };
  const switchSource = (value: 'existing' | 'new') => {
    form.setFieldValue('address_source', value);
    if (value === 'new') form.setFieldsValue({ address_id: undefined, region_id: undefined, commune_id: undefined, street: '', street_number: '', complement: '', reference: '' });
    else if (addresses[0]) selectAddress(addresses.find((row) => row.is_default) || addresses[0]);
  };

  return <Form form={form} layout="vertical" initialValues={{ ...initialValues, address_source: 'new' }} requiredMark="optional" className="sf-checkout-form">
    {authenticated && addresses.length > 0 && <div className="grid gap-4 sm:grid-cols-2"><Form.Item name="address_source" label={t('shipping.addressSource')}><Select onChange={switchSource} options={[{ value: 'existing', label: t('shipping.savedAddress') }, { value: 'new', label: t('shipping.newAddress') }]} /></Form.Item>{source === 'existing' && <Form.Item name="address_id" label={t('shipping.savedAddress')} rules={[{ required: true }]}><Select onChange={(id) => { const address = addresses.find((row) => row.id === id); if (address) selectAddress(address); }} options={addresses.map((row) => ({ value: row.id, label: `${row.label || row.recipient} · ${row.street} ${row.street_number}` }))} /></Form.Item>}</div>}
    <div className="grid gap-x-4 sm:grid-cols-2">
      <Form.Item name="full_name" label={t('shipping.fullName')} rules={[{ required: true, message: t('shipping.fullNameRequired') }, { min: 2, max: 100 }]}><Input disabled={source === 'existing'} autoComplete="name" prefix={<UserOutlined />} size="large" /></Form.Item>
      <Form.Item name="email" label={t('shipping.email')} rules={[{ required: true, message: t('shipping.emailRequired') }, { type: 'email', message: t('shipping.emailInvalid') }]}><Input autoComplete="email" prefix={<MailOutlined />} size="large" /></Form.Item>
      <Form.Item name="phone" label={t('shipping.phone')} rules={[{ required: true, message: t('shipping.phoneRequired') }]}><Input disabled={source === 'existing'} autoComplete="tel" prefix={<PhoneOutlined />} size="large" /></Form.Item>
      <Form.Item name="region_id" label={t('shipping.region')} rules={[{ required: true, message: t('shipping.regionRequired') }]}><Select disabled={source === 'existing'} showSearch optionFilterProp="label" onChange={() => form.setFieldValue('commune_id', undefined)} options={regions.map((row) => ({ value: row.id, label: row.name }))} /></Form.Item>
      <Form.Item name="commune_id" label={t('shipping.commune')} rules={[{ required: true, message: t('shipping.communeRequired') }]}><Select disabled={source === 'existing' || !regionID} showSearch optionFilterProp="label" options={communes.map((row) => ({ value: row.id, label: row.name }))} /></Form.Item>
      <Form.Item name="street" label={t('shipping.street')} rules={[{ required: true, message: t('shipping.addressRequired') }]}><Input disabled={source === 'existing'} autoComplete="address-line1" /></Form.Item>
      <Form.Item name="street_number" label={t('shipping.streetNumber')} rules={[{ required: true, message: t('shipping.addressRequired') }]}><Input disabled={source === 'existing'} /></Form.Item>
      <Form.Item name="complement" label={t('shipping.complement')}><Input disabled={source === 'existing'} autoComplete="address-line2" /></Form.Item>
      <Form.Item name="reference" label={t('shipping.reference')}><Input disabled={source === 'existing'} /></Form.Item>
    </div>
    {!authenticated && <div className="flex flex-wrap items-center gap-3"><Form.Item name="remember_address" valuePropName="checked" noStyle><Checkbox>{t('shipping.rememberInBrowser')}</Checkbox></Form.Item><Button type="link" onClick={() => { localStorage.removeItem(guestAddressKey); form.setFieldValue('remember_address', false); }}>{t('shipping.clearSaved')}</Button></div>}
  </Form>;
}

export function persistGuestAddress(values: ShippingInfo) {
  if (typeof window === 'undefined' || !values.remember_address) return;
  const { email: _email, remember_address: _remember, ...address } = values;
  localStorage.setItem(guestAddressKey, JSON.stringify({ version: 1, address }));
}
