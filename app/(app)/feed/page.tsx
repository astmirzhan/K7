import { Suspense } from 'react';
import { FeedScreen } from '@/components/app/FeedScreen';
import { PanelSkeleton } from '@/components/ui/States';

export default function FeedPage() {
  return (
    <Suspense fallback={<PanelSkeleton lines={6} />}>
      <FeedScreen />
    </Suspense>
  );
}
