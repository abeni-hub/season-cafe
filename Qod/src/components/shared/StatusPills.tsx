import { FlaskConical, Server } from 'lucide-react';
import { Pill } from '@/components/ui/badge';
import type { BatchStatus, OrderStatus, TransferStatus } from '@/types/domain';
import { ORDER_STATUS_LABELS } from '@/services/live/orderService';
import { BATCH_STATUS_LABELS } from '@/services/live/productionService';
import { TRANSFER_STATUS_LABELS } from '@/services/live/transferService';
import { HAS_REMOTE_API } from '@/config/brand';

const orderTones: Record<OrderStatus, 'neutral' | 'blue' | 'green' | 'amber' | 'clay' | 'red'> = {
  inquiry: 'neutral',
  quoted: 'amber',
  confirmed: 'blue',
  in_production: 'clay',
  ready: 'green',
  fulfilled: 'green',
  cancelled: 'red',
};

const batchTones: Record<BatchStatus, 'neutral' | 'blue' | 'green' | 'amber' | 'clay' | 'red'> = {
  pending: 'neutral',
  scheduled: 'blue',
  in_production: 'clay',
  quality_check: 'amber',
  completed: 'green',
  ready: 'green',
  cancelled: 'red',
};

const transferTones: Record<TransferStatus, 'neutral' | 'blue' | 'green' | 'amber' | 'clay' | 'red'> = {
  requested: 'neutral',
  approved: 'amber',
  dispatched: 'clay',
  received: 'green',
  cancelled: 'red',
};

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return <Pill tone={orderTones[status]}>{ORDER_STATUS_LABELS[status]}</Pill>;
}

export function BatchStatusPill({ status }: { status: BatchStatus }) {
  return <Pill tone={batchTones[status]}>{BATCH_STATUS_LABELS[status]}</Pill>;
}

export function TransferStatusPill({ status }: { status: TransferStatus }) {
  return <Pill tone={transferTones[status]}>{TRANSFER_STATUS_LABELS[status]}</Pill>;
}

export function DemoBadge({ label }: { label?: string }) {
  if (HAS_REMOTE_API) {
    return (
      <Pill tone="green" className="gap-1.5">
        <Server className="h-3 w-3" />
        {label ?? 'Live API'}
      </Pill>
    );
  }
  return (
    <Pill tone="clay" className="gap-1.5">
      <FlaskConical className="h-3 w-3" />
      {label ?? 'Demo data'}
    </Pill>
  );
}
