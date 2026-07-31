import type { OrderStatus } from '@/types';

const statusStyles: Record<OrderStatus, string> = {
  pending_payment: 'bg-[#fff0e9] text-[#a8442e]',
  pending_transfer: 'bg-[#fff5d9] text-[#835d00]',
  paid: 'bg-[#e8f4fb] text-[#17658a]',
  pending_shipment: 'bg-[#e9f5f1] text-[#216d5c]',
  shipped: 'bg-[#e8f0fa] text-[#315f91]',
  completed: 'bg-[#e4f3e9] text-[#24723f]',
  cancelled: 'bg-[#edf0ee] text-[#5d696f]',
  payment_failed: 'bg-[#fdebea] text-[#a33a32]',
};

export default function OrderStatusBadge({ status, label }: { status: OrderStatus; label: string }) {
  return (
    <span className={`inline-flex min-h-7 items-center rounded-full px-3 py-1 text-xs font-extrabold ${statusStyles[status]}`}>
      {label}
    </span>
  );
}
