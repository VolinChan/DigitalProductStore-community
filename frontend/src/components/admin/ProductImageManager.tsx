'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Empty,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Progress,
  Segmented,
  Space,
  Tag,
  Tooltip,
  Upload,
  message,
} from 'antd';
import type { UploadProps } from 'antd';
import {
  DeleteOutlined,
  DragOutlined,
  LinkOutlined,
  PictureOutlined,
  ReloadOutlined,
  StarFilled,
  StarOutlined,
  UploadOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import apiClient from '@/lib/api';
import ImageFallback from '@/components/ImageFallback';
import type { MediaAsset, ProductMedia } from '@/types';

interface ProductImageManagerProps {
  productId: number;
  media: ProductMedia[];
  onChanged: () => Promise<void> | void;
}

type UploadTask = {
  uid: string;
  name: string;
  file: File;
  percent: number;
  status: 'uploading' | 'error';
};

type LibraryResponse = {
  data: { media: MediaAsset[] };
  meta?: { page: number; per_page: number; total: number };
};

const MAX_VIDEOS = 3;

function youtubePoster(asset?: MediaAsset) {
  if (!asset || asset.mime_type !== 'video/youtube') return undefined;
  const id = asset.url.match(/[?&]v=([A-Za-z0-9_-]{11})/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined;
}

function normalized(items: ProductMedia[]) {
  return [...items]
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .map((item, sortOrder) => ({ ...item, sort_order: sortOrder }));
}

export default function ProductImageManager({ productId, media, onChanged }: ProductImageManagerProps) {
  const [items, setItems] = useState<ProductMedia[]>(normalized(media));
  const itemsRef = useRef(items);
  const mutationQueue = useRef(Promise.resolve());
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<MediaAsset[]>([]);
  const [libraryKind, setLibraryKind] = useState<'image' | 'video'>('image');
  const [libraryPage, setLibraryPage] = useState(1);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [selectedLibraryIDs, setSelectedLibraryIDs] = useState<number[]>([]);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [youtubeURL, setYoutubeURL] = useState('');
  const [coverForAssetID, setCoverForAssetID] = useState<number>();
  const [draggedID, setDraggedID] = useState<number>();

  useEffect(() => {
    const next = normalized(media);
    setItems(next);
    itemsRef.current = next;
  }, [media]);

  const persist = (transform: (current: ProductMedia[]) => ProductMedia[]) => {
    const operation = mutationQueue.current.then(async () => {
      const previous = itemsRef.current;
      const next = normalized(transform(previous));
      const primaryCount = next.filter((item) => item.is_primary).length;
      const videoCount = next.filter((item) => item.media_asset?.kind === 'video').length;
      if (primaryCount > 1) throw new Error('只能设置一张主图');
      if (videoCount > MAX_VIDEOS) throw new Error(`每个商品最多添加 ${MAX_VIDEOS} 个视频`);
      itemsRef.current = next;
      setItems(next);
      try {
        await apiClient.put(`/admin/products/${productId}/media`, {
          media: next.map((item) => ({
            media_asset_id: item.media_asset_id,
            role: item.media_asset?.kind === 'video' ? 'video' : item.role || 'gallery',
            sort_order: item.sort_order,
            is_primary: item.is_primary,
          })),
        });
        await onChanged();
      } catch (error) {
        itemsRef.current = previous;
        setItems(previous);
        throw error;
      }
    });
    mutationQueue.current = operation.catch(() => undefined);
    return operation;
  };

  const attachAssets = async (assets: MediaAsset[]) => {
    const existing = new Set(itemsRef.current.map((item) => item.media_asset_id));
    const additions = assets.filter((asset) => !existing.has(asset.id));
    if (!additions.length) return;
    await persist((current) => {
      const hasPrimary = current.some((item) => item.is_primary);
      return [...current, ...additions.map((asset, index) => ({
        id: 0,
        media_asset_id: asset.id,
        media_asset: asset,
        role: asset.kind === 'video' ? 'video' : 'gallery',
        sort_order: current.length + index,
        is_primary: !hasPrimary && index === 0 && asset.kind === 'image',
      }))];
    });
  };

  const updateTask = (uid: string, patch: Partial<UploadTask>) => {
    setTasks((current) => current.map((task) => task.uid === uid ? { ...task, ...patch } : task));
  };

  const uploadFile = async (file: File, uid: string, video: boolean) => {
    setTasks((current) => {
      const task: UploadTask = { uid, name: file.name, file, percent: 0, status: 'uploading' };
      return current.some((item) => item.uid === uid)
        ? current.map((item) => item.uid === uid ? task : item)
        : [...current, task];
    });
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await apiClient.post<{ data: MediaAsset }>(`/admin/media/${video ? 'videos' : 'images'}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => updateTask(uid, { percent: event.total ? Math.round(event.loaded * 100 / event.total) : 0 }),
      });
      await attachAssets([response.data.data]);
      setTasks((current) => current.filter((task) => task.uid !== uid));
      message.success(`${file.name} 上传成功`);
    } catch {
      updateTask(uid, { status: 'error' });
      message.error(`${file.name} 上传失败`);
      throw new Error('upload failed');
    }
  };

  const imageUploadProps: UploadProps = {
    accept: 'image/jpeg,image/png,image/webp',
    showUploadList: false,
    multiple: true,
    customRequest: async ({ file, onError, onProgress, onSuccess }) => {
      const upload = file as File & { uid?: string };
      const uid = upload.uid ?? `${upload.name}-${upload.size}-${upload.lastModified}`;
      try {
        await uploadFile(upload, uid, false);
        onProgress?.({ percent: 100 });
        onSuccess?.({});
      } catch (error) {
        onError?.(error as Error);
      }
    },
  };

  const videoUploadProps: UploadProps = {
    accept: 'video/mp4,video/webm',
    showUploadList: false,
    multiple: true,
    customRequest: async ({ file, onError, onProgress, onSuccess }) => {
      const upload = file as File & { uid?: string };
      const uid = upload.uid ?? `${upload.name}-${upload.size}-${upload.lastModified}`;
      try {
        await uploadFile(upload, uid, true);
        onProgress?.({ percent: 100 });
        onSuccess?.({});
      } catch (error) {
        onError?.(error as Error);
      }
    },
  };

  const loadLibrary = async (kind = libraryKind, page = libraryPage) => {
    setLibraryLoading(true);
    try {
      const response = await apiClient.get<LibraryResponse>('/admin/media', { params: { kind, page, page_size: 12 } });
      setLibrary(response.data.data.media ?? []);
      setLibraryTotal(response.data.meta?.total ?? 0);
    } catch {
      message.error('媒体库加载失败');
    } finally {
      setLibraryLoading(false);
    }
  };

  const openLibrary = () => {
    setCoverForAssetID(undefined);
    setSelectedLibraryIDs([]);
    setLibraryOpen(true);
    void loadLibrary('image', 1);
  };

  const openCoverLibrary = (assetID: number) => {
    setCoverForAssetID(assetID);
    setLibraryKind('image');
    setLibraryPage(1);
    setSelectedLibraryIDs([]);
    setLibraryOpen(true);
    void loadLibrary('image', 1);
  };

  const setVideoCover = async (coverAssetID: number) => {
    if (!coverForAssetID) return;
    const response = await apiClient.put<{ data: MediaAsset }>(`/admin/media/${coverForAssetID}`, { cover_asset_id: coverAssetID });
    const updated = response.data.data;
    itemsRef.current = itemsRef.current.map((item) => item.media_asset_id === updated.id ? { ...item, media_asset: updated } : item);
    setItems(itemsRef.current);
  };

  const addYouTube = async () => {
    try {
      const response = await apiClient.post<{ data: MediaAsset }>('/admin/media/youtube', { url: youtubeURL });
      await attachAssets([response.data.data]);
      setYoutubeOpen(false);
      setYoutubeURL('');
    } catch {
      message.error('请输入有效的 HTTPS YouTube 链接');
    }
  };

  const setPrimary = async (assetID: number) => {
    try {
      await persist((current) => current.map((item) => ({ ...item, is_primary: item.media_asset_id === assetID })));
    } catch { message.error('设置主图失败'); }
  };

  const remove = async (assetID: number) => {
    try {
      await persist((current) => current.filter((item) => item.media_asset_id !== assetID));
    } catch { message.error('移除媒体失败'); }
  };

  const saveAlt = async (asset: MediaAsset, value: string) => {
    if ((asset.alt_text ?? '') === value.trim()) return;
    try {
      const response = await apiClient.put<{ data: MediaAsset }>(`/admin/media/${asset.id}`, { alt_text: value.trim() || null });
      const updated = response.data.data;
      itemsRef.current = itemsRef.current.map((item) => item.media_asset_id === asset.id ? { ...item, media_asset: updated } : item);
      setItems(itemsRef.current);
    } catch { message.error('替代文本保存失败'); }
  };

  const dropOn = async (targetID: number) => {
    if (!draggedID || draggedID === targetID) return;
    try {
      await persist((current) => {
        const reordered = [...current];
        const from = reordered.findIndex((item) => item.media_asset_id === draggedID);
        const to = reordered.findIndex((item) => item.media_asset_id === targetID);
        const [moved] = reordered.splice(from, 1);
        reordered.splice(to, 0, moved);
        return reordered;
      });
    } catch { message.error('媒体排序失败'); }
    finally { setDraggedID(undefined); }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Space wrap>
          <Upload {...imageUploadProps}><Button icon={<UploadOutlined />}>上传图片</Button></Upload>
          <Upload {...videoUploadProps}><Button icon={<VideoCameraOutlined />}>上传视频</Button></Upload>
          <Button icon={<LinkOutlined />} onClick={() => setYoutubeOpen(true)}>YouTube</Button>
          <Button icon={<PictureOutlined />} onClick={openLibrary}>媒体库</Button>
        </Space>
        <span className="text-sm text-gray-500">视频 {items.filter((item) => item.media_asset?.kind === 'video').length}/{MAX_VIDEOS}</span>
      </div>

      {tasks.length > 0 && <div className="mb-4 space-y-2 border-y py-3">
        {tasks.map((task) => <div key={task.uid} className="grid grid-cols-[minmax(0,1fr)_120px_32px] items-center gap-3 text-sm">
          <span className="truncate">{task.name}</span>
          <Progress percent={task.percent} status={task.status === 'error' ? 'exception' : 'active'} size="small" />
          {task.status === 'error' && <Tooltip title="重试"><Button aria-label={`重试上传 ${task.name}`} size="small" type="text" icon={<ReloadOutlined />} onClick={() => void uploadFile(task.file, task.uid, task.file.type.startsWith('video/'))} /></Tooltip>}
        </div>)}
      </div>}

      {items.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未添加商品媒体" /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item, index) => {
            const asset = item.media_asset;
            const poster = youtubePoster(asset) ?? asset?.cover_asset?.url;
            const isVideo = asset?.kind === 'video';
            return <div
              key={item.media_asset_id}
              draggable
              onDragStart={() => setDraggedID(item.media_asset_id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => void dropOn(item.media_asset_id)}
              data-media-id={item.media_asset_id}
              className="overflow-hidden rounded-md border bg-white"
            >
              <div className="relative aspect-square bg-gray-50">
                {asset && (!isVideo || poster)
                  ? <ImageFallback src={poster ?? asset.url} alt={asset.alt_text || `商品媒体 ${index + 1}`} fill className="object-contain p-1" sizes="180px" />
                  : <div className="flex h-full items-center justify-center text-gray-400"><VideoCameraOutlined className="text-3xl" /></div>}
                <Tag className="absolute left-2 top-2 m-0" color={isVideo ? 'blue' : item.is_primary ? 'gold' : 'default'}>{isVideo ? '视频' : item.is_primary ? '主图' : '图片'}</Tag>
                <DragOutlined className="absolute right-2 top-2 cursor-grab text-lg text-gray-500" />
              </div>
              {!isVideo && asset && <Input aria-label={`Alt text ${asset.id}`} defaultValue={asset.alt_text} key={`${asset.id}-${asset.alt_text ?? ''}`} maxLength={300} placeholder="替代文本" variant="borderless" onBlur={(event) => void saveAlt(asset, event.target.value)} />}
              <div className="flex items-center justify-end border-t p-1">
                {isVideo && asset?.mime_type !== 'video/youtube' && <Tooltip title="选择视频封面"><Button type="text" icon={<PictureOutlined />} onClick={() => openCoverLibrary(item.media_asset_id)} /></Tooltip>}
                {!isVideo && <Tooltip title={item.is_primary ? '当前主图' : '设为主图'}><Button type="text" disabled={item.is_primary} icon={item.is_primary ? <StarFilled className="text-amber-500" /> : <StarOutlined />} onClick={() => void setPrimary(item.media_asset_id)} /></Tooltip>}
                <Popconfirm title="从商品图库移除？" onConfirm={() => void remove(item.media_asset_id)}><Tooltip title="移除"><Button type="text" danger icon={<DeleteOutlined />} /></Tooltip></Popconfirm>
              </div>
            </div>;
          })}
        </div>
      )}

      <Modal title={coverForAssetID ? '选择视频封面' : '选择媒体'} open={libraryOpen} width={760} okText={coverForAssetID ? '设为封面' : '添加所选媒体'} onCancel={() => setLibraryOpen(false)} onOk={async () => {
        try {
          if (coverForAssetID) {
            if (!selectedLibraryIDs[0]) return;
            await setVideoCover(selectedLibraryIDs[0]);
          } else {
            await attachAssets(library.filter((asset) => selectedLibraryIDs.includes(asset.id)));
          }
          setLibraryOpen(false);
        } catch { message.error('添加媒体失败'); }
      }}>
        {!coverForAssetID && <Segmented value={libraryKind} options={[{ value: 'image', label: '图片' }, { value: 'video', label: '视频' }]} onChange={(value) => {
          const kind = value as 'image' | 'video';
          setLibraryKind(kind); setLibraryPage(1); setSelectedLibraryIDs([]); void loadLibrary(kind, 1);
        }} />}
        <div className="my-4 grid min-h-56 grid-cols-3 gap-3 sm:grid-cols-4">
          {!libraryLoading && library.length === 0 ? <div className="col-span-full"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /></div> : library.map((asset) => {
            const selected = selectedLibraryIDs.includes(asset.id);
            return <button key={asset.id} type="button" aria-label={`Select media ${asset.id}`} className={`relative aspect-square overflow-hidden rounded-md border bg-gray-50 ${selected ? 'border-blue-500 ring-2 ring-blue-100' : ''}`} onClick={() => setSelectedLibraryIDs((current) => coverForAssetID ? [asset.id] : selected ? current.filter((id) => id !== asset.id) : [...current, asset.id])}>
              {asset.kind === 'image' || youtubePoster(asset) ? <ImageFallback src={youtubePoster(asset) ?? asset.url} alt={asset.alt_text || ''} fill className="object-contain" sizes="160px" /> : <VideoCameraOutlined className="text-3xl text-gray-400" />}
              {selected && <Tag color="blue" className="absolute left-1 top-1 m-0">已选</Tag>}
            </button>;
          })}
        </div>
        <Pagination size="small" current={libraryPage} pageSize={12} total={libraryTotal} hideOnSinglePage onChange={(page) => { setLibraryPage(page); void loadLibrary(libraryKind, page); }} />
      </Modal>

      <Modal title="添加 YouTube 视频" open={youtubeOpen} okText="添加" okButtonProps={{ disabled: !youtubeURL.trim() }} onCancel={() => setYoutubeOpen(false)} onOk={() => void addYouTube()}>
        <Input prefix={<LinkOutlined />} value={youtubeURL} onChange={(event) => setYoutubeURL(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
      </Modal>
    </div>
  );
}
