import { Suspense } from 'react';
import { BillingSuccess } from '@/components/app/BillingSuccess';
import { PanelSkeleton } from '@/components/ui/States';

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={<PanelSkeleton lines={3} className="mx-auto max-w-[480px]" />}>
      <BillingSuccess />
    </Suspense>
  );
}
