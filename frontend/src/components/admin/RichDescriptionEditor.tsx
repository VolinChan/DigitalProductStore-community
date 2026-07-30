'use client';

import { useEffect, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Button, Divider, Input, Modal, Pagination, Segmented, Space, Tooltip, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import {
  ArrowDownOutlined, ArrowUpOutlined, BoldOutlined, DeleteOutlined, ItalicOutlined,
  LinkOutlined, OrderedListOutlined, PictureOutlined, UnorderedListOutlined,
  UploadOutlined, VideoCameraOutlined,
} from '@ant-design/icons';
import apiClient from '@/lib/api';
import ImageFallback from '@/components/ImageFallback';
import type { MediaAsset } from '@/types';

interface RichDescriptionEditorProps {
  value?: string;
  onChange?: (value: string) => void;
}

type LibraryResponse = { data: { media: MediaAsset[] }; meta?: { total: number } };

const CatalogImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaAssetId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-media-asset-id'),
        renderHTML: (attributes) => attributes.mediaAssetId ? { 'data-media-asset-id': attributes.mediaAssetId } : {},
      },
    };
  },
});

const CatalogVideo = Node.create({
  name: 'catalogVideo',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null, parseHTML: (element) => element.getAttribute('src') ?? element.getAttribute('data-video-url') },
      poster: { default: null },
      mediaAssetId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-media-asset-id'),
        renderHTML: (attributes) => attributes.mediaAssetId ? { 'data-media-asset-id': attributes.mediaAssetId } : {},
      },
      provider: { default: 'upload', parseHTML: (element) => element.getAttribute('data-video-provider') ?? 'upload' },
    };
  },
  parseHTML() { return [{ tag: 'video[src]' }, { tag: 'div[data-video-provider]' }]; },
  renderHTML({ HTMLAttributes }) {
    if (HTMLAttributes.provider === 'youtube') {
      return ['div', mergeAttributes(HTMLAttributes, {
        'data-video-provider': 'youtube', 'data-video-url': HTMLAttributes.src,
        class: 'catalog-youtube-placeholder',
      }), 'YouTube video'];
    }
    return ['video', mergeAttributes(HTMLAttributes, { controls: 'controls', preload: 'metadata' })];
  },
});

function videoPoster(asset: MediaAsset) {
  if (asset.mime_type === 'video/youtube') {
    const id = asset.url.match(/[?&]v=([A-Za-z0-9_-]{11})/)?.[1];
    if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }
  return asset.cover_asset?.url;
}

export default function RichDescriptionEditor({ value = '', onChange }: RichDescriptionEditorProps) {
  const [mode, setMode] = useState<'visual' | 'source'>('visual');
  const [source, setSource] = useState(value);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkURL, setLinkURL] = useState('https://');
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaKind, setMediaKind] = useState<'image' | 'video'>('image');
  const [library, setLibrary] = useState<MediaAsset[]>([]);
  const [libraryPage, setLibraryPage] = useState(1);
  const [libraryTotal, setLibraryTotal] = useState(0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      CatalogImage.configure({ allowBase64: false, inline: false }),
      CatalogVideo,
      Placeholder.configure({ placeholder: '输入商品描述，或从工具栏插入媒体' }),
    ],
    content: value,
    editorProps: { attributes: { class: 'catalog-rich-editor', 'aria-label': 'Rich product description' } },
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      setSource(html);
      onChange?.(html);
    },
  });

  useEffect(() => {
    if (!editor || mode !== 'visual' || value === editor.getHTML()) return;
    editor.commands.setContent(value || '', { emitUpdate: false });
    setSource(value || '');
  }, [editor, mode, value]);

  const switchMode = (next: 'visual' | 'source') => {
    if (!editor) return;
    if (next === 'source') setSource(editor.getHTML());
    else editor.commands.setContent(source || '', { emitUpdate: true });
    setMode(next);
  };

  const currentBlockIndex = () => editor ? editor.state.selection.$from.index(0) : -1;

  const moveBlock = (direction: -1 | 1) => {
    if (!editor) return;
    const nodes = [...editor.state.doc.content.content];
    const index = currentBlockIndex();
    const target = index + direction;
    if (index < 0 || target < 0 || target >= nodes.length) return;
    [nodes[index], nodes[target]] = [nodes[target], nodes[index]];
    editor.view.dispatch(editor.state.tr.replaceWith(0, editor.state.doc.content.size, nodes));
    editor.commands.focus();
    onChange?.(editor.getHTML());
  };

  const deleteBlock = () => {
    if (!editor) return;
    const blocks: Array<{ from: number; to: number }> = [];
    editor.state.doc.forEach((node, offset) => blocks.push({ from: offset, to: offset + node.nodeSize }));
    const target = blocks[currentBlockIndex()];
    if (target) editor.view.dispatch(editor.state.tr.delete(target.from, target.to));
    onChange?.(editor.getHTML());
  };

  const loadLibrary = async (kind = mediaKind, page = libraryPage) => {
    try {
      const response = await apiClient.get<LibraryResponse>('/admin/media', { params: { kind, page, page_size: 12 } });
      setLibrary(response.data.data.media ?? []);
      setLibraryTotal(response.data.meta?.total ?? 0);
    } catch { message.error('媒体库加载失败'); }
  };

  const openMedia = (kind: 'image' | 'video') => {
    setMediaKind(kind); setLibraryPage(1); setMediaOpen(true); void loadLibrary(kind, 1);
  };

  const insertMedia = (asset: MediaAsset) => {
    if (!editor) return;
    if (asset.kind === 'image') {
      editor.chain().focus().insertContent({ type: 'image', attrs: { src: asset.url, alt: asset.alt_text ?? '', mediaAssetId: asset.id } }).run();
    } else {
      editor.chain().focus().insertContent({ type: 'catalogVideo', attrs: {
        src: asset.url, poster: videoPoster(asset), mediaAssetId: asset.id,
        provider: asset.mime_type === 'video/youtube' ? 'youtube' : 'upload',
      } }).run();
    }
    setMediaOpen(false);
  };

  const uploadProps: UploadProps = {
    accept: mediaKind === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/webm',
    showUploadList: false,
    customRequest: async ({ file, onError, onSuccess }) => {
      const formData = new FormData();
      formData.append('file', file as File);
      try {
        const endpoint = mediaKind === 'image' ? 'images' : 'videos';
        const response = await apiClient.post<{ data: MediaAsset }>(`/admin/media/${endpoint}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        insertMedia(response.data.data);
        onSuccess?.({});
      } catch (error) {
        onError?.(error as Error); message.error('媒体上传失败');
      }
    },
  };

  if (!editor) return <div className="min-h-64 border" />;

  return <div className="overflow-hidden rounded-md border">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-gray-50 p-2">
      <Segmented value={mode} options={[{ value: 'visual', label: '可视模式' }, { value: 'source', label: 'HTML 源码' }]} onChange={(next) => switchMode(next as 'visual' | 'source')} />
      {mode === 'visual' && <Space size={2} wrap>
        <Tooltip title="粗体"><Button aria-label="Bold" type={editor.isActive('bold') ? 'primary' : 'text'} icon={<BoldOutlined />} onClick={() => editor.chain().focus().toggleBold().run()} /></Tooltip>
        <Tooltip title="斜体"><Button aria-label="Italic" type={editor.isActive('italic') ? 'primary' : 'text'} icon={<ItalicOutlined />} onClick={() => editor.chain().focus().toggleItalic().run()} /></Tooltip>
        <Button type={editor.isActive('heading', { level: 2 }) ? 'primary' : 'text'} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Button>
        <Button type={editor.isActive('heading', { level: 3 }) ? 'primary' : 'text'} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Button>
        <Tooltip title="无序列表"><Button aria-label="Bullet list" type={editor.isActive('bulletList') ? 'primary' : 'text'} icon={<UnorderedListOutlined />} onClick={() => editor.chain().focus().toggleBulletList().run()} /></Tooltip>
        <Tooltip title="有序列表"><Button aria-label="Ordered list" type={editor.isActive('orderedList') ? 'primary' : 'text'} icon={<OrderedListOutlined />} onClick={() => editor.chain().focus().toggleOrderedList().run()} /></Tooltip>
        <Button type={editor.isActive('blockquote') ? 'primary' : 'text'} onClick={() => editor.chain().focus().toggleBlockquote().run()}>引用</Button>
        <Tooltip title="链接"><Button aria-label="Link" type="text" icon={<LinkOutlined />} onClick={() => setLinkOpen(true)} /></Tooltip>
        <Tooltip title="分隔线"><Button aria-label="Horizontal rule" type="text" onClick={() => editor.chain().focus().setHorizontalRule().run()}>—</Button></Tooltip>
        <Tooltip title="图片"><Button aria-label="Insert image" type="text" icon={<PictureOutlined />} onClick={() => openMedia('image')} /></Tooltip>
        <Tooltip title="视频"><Button aria-label="Insert video" type="text" icon={<VideoCameraOutlined />} onClick={() => openMedia('video')} /></Tooltip>
        <Divider orientation="vertical" />
        <Tooltip title="上移当前块"><Button aria-label="Move block up" type="text" icon={<ArrowUpOutlined />} onClick={() => moveBlock(-1)} /></Tooltip>
        <Tooltip title="下移当前块"><Button aria-label="Move block down" type="text" icon={<ArrowDownOutlined />} onClick={() => moveBlock(1)} /></Tooltip>
        <Tooltip title="删除当前块"><Button aria-label="Delete block" type="text" danger icon={<DeleteOutlined />} onClick={deleteBlock} /></Tooltip>
      </Space>}
    </div>

    {mode === 'visual'
      ? <EditorContent editor={editor} />
      : <Input.TextArea aria-label="HTML source" value={source} onChange={(event) => { setSource(event.target.value); onChange?.(event.target.value); }} autoSize={{ minRows: 14, maxRows: 28 }} variant="borderless" className="font-mono" />}

    <Modal title="设置链接" open={linkOpen} okText="应用" onCancel={() => setLinkOpen(false)} onOk={() => {
      if (linkURL.trim()) editor.chain().focus().extendMarkRange('link').setLink({ href: linkURL.trim() }).run();
      else editor.chain().focus().unsetLink().run();
      setLinkOpen(false);
    }}><Input prefix={<LinkOutlined />} value={linkURL} onChange={(event) => setLinkURL(event.target.value)} /></Modal>

    <Modal title={mediaKind === 'image' ? '选择图片' : '选择视频'} open={mediaOpen} width={760} footer={null} onCancel={() => setMediaOpen(false)}>
      <div className="mb-4 flex items-center justify-between">
        <Segmented value={mediaKind} options={[{ value: 'image', label: '图片' }, { value: 'video', label: '视频' }]} onChange={(next) => { const kind = next as 'image' | 'video'; setMediaKind(kind); setLibraryPage(1); void loadLibrary(kind, 1); }} />
        <Upload {...uploadProps}><Button icon={<UploadOutlined />}>上传并插入</Button></Upload>
      </div>
      <div className="grid min-h-56 grid-cols-3 gap-3 sm:grid-cols-4">
        {library.map((asset) => <button key={asset.id} type="button" aria-label={`Insert media ${asset.id}`} className="relative aspect-square overflow-hidden rounded-md border bg-gray-50" onClick={() => insertMedia(asset)}>
          {asset.kind === 'image' || videoPoster(asset)
            ? <ImageFallback src={asset.kind === 'image' ? asset.url : videoPoster(asset) ?? asset.url} alt={asset.alt_text ?? ''} fill className="object-contain" sizes="160px" />
            : <VideoCameraOutlined className="text-3xl text-gray-400" />}
        </button>)}
      </div>
      <Pagination className="mt-4" size="small" current={libraryPage} pageSize={12} total={libraryTotal} hideOnSinglePage onChange={(page) => { setLibraryPage(page); void loadLibrary(mediaKind, page); }} />
    </Modal>
  </div>;
}
