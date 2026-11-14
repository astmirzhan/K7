import { Suspense } from 'react';
import { MapScreen } from '@/components/app/MapScreen';
import { PanelSkeleton } from '@/components/ui/States';

export default function MapPage() {
  return (
    <Suspense fallback={<PanelSkeleton lines={6} />}>
      <MapScreen />
    </Suspense>
  );
}
