'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, InputNumber, Select, Space, Spin, Tag, message } from 'antd';
import { DeleteOutlined, DragOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import apiClient from '@/lib/api';
import type { CategorySpecTemplateField } from '@/types';

type SpecificationRow = {
  id?: number;
  group_name: string;
  spec_key: string;
  label: string;
  input_type: string;
  value_text?: string;
  value_number?: string;
  unit?: string;
  sort_order: number;
  required?: boolean;
  from_template?: boolean;
};

interface SpecificationEditorProps {
  productId: number;
  template?: CategorySpecTemplateField[];
  onChanged: () => Promise<void> | void;
}

const editorInputType = (inputType: CategorySpecTemplateField['input_type']) => {
  if (inputType === 'number_unit') return 'number';
  if (inputType === 'short_text') return 'text';
  if (inputType === 'single_select' || inputType === 'multi_select') return 'select';
  return inputType;
};

export default function SpecificationEditor({ productId, template = [], onChanged }: SpecificationEditorProps) {
  const [rows, setRows] = useState<SpecificationRow[]>([]);
  const [version, setVersion] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<{ data: { specifications: SpecificationRow[]; version: number } }>(`/admin/products/${productId}/specifications`);
      setRows(response.data.data.specifications ?? []);
      setVersion(response.data.data.version);
    } catch { message.error('规格加载失败'); }
    finally { setLoading(false); }
  }, [productId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (loading || !template.length) return;
    setRows((current) => {
      const next = [...current];
      const byKey = new Map(next.map((row, index) => [`${row.group_name || 'General'}\u0000${row.spec_key}`, index]));
      template.forEach((field) => {
        const group = field.group?.trim() || 'General';
        const key = `${group}\u0000${field.key}`;
        const existing = byKey.get(key);
        if (existing !== undefined) {
          next[existing] = {
            ...next[existing],
            label: field.label,
            input_type: editorInputType(field.input_type),
            unit: field.input_type === 'number_unit' ? field.unit : next[existing].unit,
            required: field.required,
            from_template: true,
          };
          return;
        }
        byKey.set(key, next.length);
        next.push({
          group_name: group,
          spec_key: field.key,
          label: field.label,
          input_type: editorInputType(field.input_type),
          unit: field.input_type === 'number_unit' ? field.unit : undefined,
          sort_order: field.sort_order,
          required: field.required,
          from_template: true,
        });
      });
      return next;
    });
  }, [loading, template]);

  const errors = useMemo(() => {
    const result = new Map<number, string>();
    const seen = new Map<string, number>();
    rows.forEach((row, index) => {
      const group = row.group_name.trim() || 'General';
      const key = row.spec_key.trim();
      if (!row.label.trim() || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(key)) result.set(index, '名称和 key 无效');
      const unique = `${group}\u0000${key}`;
      if (seen.has(unique)) { result.set(index, '同组 key 重复'); result.set(seen.get(unique)!, '同组 key 重复'); }
      seen.set(unique, index);
      const empty = row.input_type === 'number' ? row.value_number === undefined || row.value_number === '' : !row.value_text?.trim();
      if (row.required && empty) result.set(index, '必填规格不能为空');
      if (row.input_type !== 'number' && row.unit?.trim()) result.set(index, '只有数值规格可以设置单位');
    });
    return result;
  }, [rows]);

  const update = (index: number, patch: Partial<SpecificationRow>) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));

  const save = async () => {
    if (errors.size) { message.error('请先修正规格错误'); return; }
    setSaving(true);
    try {
      const response = await apiClient.put<{ data: { version: number } }>(`/admin/products/${productId}/specifications`, {
        version,
        specifications: rows.map((row, index) => ({ ...row, sort_order: index, group_name: row.group_name.trim() || 'General', spec_key: row.spec_key.trim(), label: row.label.trim(), unit: row.unit?.trim() || null })),
      });
      setVersion(response.data.data.version);
      await onChanged();
      await load();
      message.success('规格已保存');
    } catch { message.error('规格保存失败，请刷新后重试'); }
    finally { setSaving(false); }
  };

  const drop = (target: number) => {
    if (draggedIndex === undefined || draggedIndex === target) return;
    setRows((current) => {
      const next = [...current];
      const [moved] = next.splice(draggedIndex, 1);
      next.splice(target, 0, moved);
      return next;
    });
    setDraggedIndex(undefined);
  };

  if (loading) return <div className="py-10 text-center"><Spin /></div>;

  return <div>
    <div className="mb-3 flex justify-end"><Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void save()}>保存规格</Button></div>
    <div className="space-y-2">
      {rows.map((row, index) => <div key={row.id ?? `new-${index}`} draggable onDragStart={() => setDraggedIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => drop(index)} className={`grid gap-2 border-b pb-2 md:grid-cols-[28px_110px_140px_minmax(120px,1fr)_100px_minmax(120px,1fr)_80px_36px] ${errors.has(index) ? 'border-red-400' : ''}`}>
        <DragOutlined className="mt-2 cursor-grab text-gray-400" />
        <Input value={row.group_name} placeholder="分组" onChange={(event) => update(index, { group_name: event.target.value })} />
        <div><Input value={row.label} placeholder="参数名称" onChange={(event) => update(index, { label: event.target.value })} />{row.from_template && <Tag className="mt-1">模板</Tag>}</div>
        <div><Input value={row.spec_key} disabled={row.from_template} placeholder="spec_key" onChange={(event) => update(index, { spec_key: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') })} />{errors.get(index) && <div className="text-xs text-red-500">{errors.get(index)}</div>}</div>
        <Select value={row.input_type || 'text'} options={[{ value: 'text', label: '文本' }, { value: 'long_text', label: '长文本' }, { value: 'number', label: '数值' }, { value: 'boolean', label: '是/否' }]} onChange={(input_type) => update(index, { input_type, value_text: undefined, value_number: undefined, unit: input_type === 'number' ? row.unit : undefined })} />
        {row.input_type === 'number'
          ? <InputNumber stringMode className="w-full" value={row.value_number} onChange={(value) => update(index, { value_number: value?.toString() })} />
          : row.input_type === 'boolean'
            ? <Select allowClear value={row.value_text} options={[{ value: 'true', label: '是' }, { value: 'false', label: '否' }]} onChange={(value_text) => update(index, { value_text })} />
            : <Input value={row.value_text} onChange={(event) => update(index, { value_text: event.target.value })} />}
        <Input value={row.unit} disabled={row.input_type !== 'number'} placeholder="单位" onChange={(event) => update(index, { unit: event.target.value })} />
        <Button danger type="text" icon={<DeleteOutlined />} aria-label="删除规格" onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} />
      </div>)}
    </div>
    <Space className="mt-3"><Button type="dashed" icon={<PlusOutlined />} onClick={() => setRows((current) => [...current, { group_name: 'General', spec_key: '', label: '', input_type: 'text', sort_order: current.length }])}>添加自定义规格</Button></Space>
  </div>;
}
