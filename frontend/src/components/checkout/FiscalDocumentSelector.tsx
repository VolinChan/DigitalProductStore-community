'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Checkbox, Form, Input, Select, type FormInstance } from 'antd';
import { useTranslations } from 'next-intl';
import apiClient from '@/lib/api';
import type { ChileCommune, ChileRegion } from '@/types';

export type FiscalDocumentIntent = 'boleta' | 'factura';

export interface FiscalTaxFormValues {
  tax_rut?: string;
  tax_legal_name?: string;
  tax_business_activity?: string;
  tax_fiscal_address?: string;
  tax_address_same_as_shipping?: boolean;
  tax_region_id?: number;
  tax_commune_id?: number;
  tax_email?: string;
}

type CheckoutFiscalForm = FiscalTaxFormValues & {
  region_id?: number;
  commune_id?: number;
  street?: string;
  street_number?: string;
  complement?: string;
};

function shippingFiscalAddress(values: CheckoutFiscalForm): string {
  const street = [values.street?.trim(), values.street_number?.trim()].filter(Boolean).join(' ');
  return [street, values.complement?.trim()].filter(Boolean).join(', ');
}

export default function FiscalDocumentSelector({ form, value, onChange }: { form: FormInstance; value: FiscalDocumentIntent; onChange: (value: FiscalDocumentIntent) => void }) {
  const t = useTranslations('checkout.fiscal');
  const [regions, setRegions] = useState<ChileRegion[]>([]);
  const [communes, setCommunes] = useState<ChileCommune[]>([]);
  const sameAsShipping = Form.useWatch('tax_address_same_as_shipping', form) !== false;
  const shippingRegionID = Form.useWatch('region_id', form) as number | undefined;
  const shippingCommuneID = Form.useWatch('commune_id', form) as number | undefined;
  const taxRegionID = Form.useWatch('tax_region_id', form) as number | undefined;
  const street = Form.useWatch('street', form) as string | undefined;
  const streetNumber = Form.useWatch('street_number', form) as string | undefined;
  const complement = Form.useWatch('complement', form) as string | undefined;
  const activeRegionID = sameAsShipping ? shippingRegionID : taxRegionID;

  useEffect(() => {
    if (value !== 'factura') return;
    let active = true;
    void apiClient.get('/locations/regions').then((response) => {
      if (active) setRegions(response.data.data || []);
    }).catch(() => { if (active) setRegions([]); });
    return () => { active = false; };
  }, [value]);

  useEffect(() => {
    if (value !== 'factura' || !activeRegionID) { setCommunes([]); return; }
    let active = true;
    void apiClient.get(`/locations/regions/${activeRegionID}/communes`).then((response) => {
      if (active) setCommunes(response.data.data || []);
    }).catch(() => { if (active) setCommunes([]); });
    return () => { active = false; };
  }, [activeRegionID, value]);

  useEffect(() => {
    if (value !== 'factura' || !sameAsShipping) return;
    form.setFieldsValue({
      tax_region_id: shippingRegionID,
      tax_commune_id: shippingCommuneID,
      tax_fiscal_address: shippingFiscalAddress({ street, street_number: streetNumber, complement }),
    });
  }, [complement, form, sameAsShipping, shippingCommuneID, shippingRegionID, street, streetNumber, value]);

  const sharedAddressSummary = useMemo(() => {
    const address = shippingFiscalAddress({ street, street_number: streetNumber, complement });
    const region = regions.find((row) => row.id === Number(shippingRegionID))?.name;
    const commune = communes.find((row) => row.id === Number(shippingCommuneID))?.name;
    return address && region && commune ? [address, commune, region].join(' · ') : '';
  }, [communes, complement, regions, shippingCommuneID, shippingRegionID, street, streetNumber]);

  const options: Array<{ value: FiscalDocumentIntent; title: string; description: string }> = [
    { value: 'boleta', title: t('boleta'), description: t('boletaDescription') },
    { value: 'factura', title: t('factura'), description: t('facturaDescription') },
  ];

  return <div>
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((option) => <label key={option.value} className={`relative cursor-pointer rounded-[18px] border p-4 transition ${value === option.value ? 'border-[var(--sf-accent)] bg-[var(--sf-soft-blue)] ring-1 ring-[var(--sf-accent)]/20' : 'border-[var(--sf-line)] bg-white hover:border-[var(--sf-accent)]/50'}`}>
        <input type="radio" name="fiscal_document_intent" value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        <span className="block text-sm font-black text-[var(--sf-ink)]">{option.title}</span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--sf-muted)]">{option.description}</span>
      </label>)}
    </div>
    <p className="mt-3 text-xs leading-5 text-[var(--sf-muted)]">{t('selectionNotice')}</p>
    {value === 'factura' && <div data-testid="factura-tax-profile" className="mt-5 grid gap-x-4 sm:grid-cols-2">
      <Form.Item name="tax_rut" preserve={false} label={t('rut')} rules={[{ required: true, message: t('required') }, { max: 20, message: t('tooLong') }]}><Input autoComplete="off" placeholder="12.345.678-5" /></Form.Item>
      <Form.Item name="tax_legal_name" preserve={false} label={t('legalName')} rules={[{ required: true, message: t('required') }, { max: 200, message: t('tooLong') }]}><Input autoComplete="organization" /></Form.Item>
      <Form.Item name="tax_business_activity" preserve={false} label={t('businessActivity')} rules={[{ required: true, message: t('required') }, { max: 200, message: t('tooLong') }]}><Input /></Form.Item>
      <Form.Item name="tax_email" preserve={false} label={t('taxEmail')} rules={[{ required: true, message: t('required') }, { type: 'email', message: t('invalidEmail') }, { max: 254, message: t('tooLong') }]}><Input autoComplete="email" inputMode="email" /></Form.Item>
      <Form.Item name="tax_address_same_as_shipping" preserve={false} initialValue={true} valuePropName="checked" className="sm:col-span-2">
        <Checkbox onChange={(event) => {
          if (!event.target.checked) form.setFieldsValue({ tax_fiscal_address: undefined, tax_region_id: undefined, tax_commune_id: undefined });
        }}>{t('sameAsShipping')}</Checkbox>
      </Form.Item>
      {sameAsShipping ? <>
        <div className="mb-6 sm:col-span-2"><Alert type={sharedAddressSummary ? 'info' : 'warning'} showIcon message={sharedAddressSummary || t('sameAddressPending')} description={t('sameAsShippingDescription')} /></div>
        <Form.Item name="tax_fiscal_address" preserve={false} hidden rules={[{ required: true, message: t('required') }, { max: 300, message: t('tooLong') }]}><Input /></Form.Item>
        <Form.Item name="tax_region_id" preserve={false} hidden rules={[{ required: true, message: t('regionRequired') }]}><Input /></Form.Item>
        <Form.Item name="tax_commune_id" preserve={false} hidden rules={[{ required: true, message: t('communeRequired') }]}><Input /></Form.Item>
      </> : <>
        <Form.Item name="tax_fiscal_address" preserve={false} label={t('fiscalAddress')} rules={[{ required: true, message: t('required') }, { max: 300, message: t('tooLong') }]} className="sm:col-span-2"><Input autoComplete="street-address" /></Form.Item>
        <Form.Item name="tax_region_id" preserve={false} label={t('region')} rules={[{ required: true, message: t('regionRequired') }]}>
          <Select showSearch optionFilterProp="label" onChange={() => form.setFieldValue('tax_commune_id', undefined)} options={regions.map((row) => ({ value: row.id, label: row.name }))} />
        </Form.Item>
        <Form.Item name="tax_commune_id" preserve={false} label={t('commune')} rules={[{ required: true, message: t('communeRequired') }]}>
          <Select disabled={!taxRegionID} showSearch optionFilterProp="label" options={communes.map((row) => ({ value: row.id, label: row.name }))} />
        </Form.Item>
      </>}
    </div>}
  </div>;
}
