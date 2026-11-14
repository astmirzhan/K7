import { Suspense } from 'react';
import { RoadmapScreen } from '@/components/app/RoadmapScreen';
import { PanelSkeleton } from '@/components/ui/States';

export default function RoadmapPage() {
  return (
    <Suspense fallback={<PanelSkeleton lines={5} />}>
      <RoadmapScreen mode="roadmap" />
    </Suspense>
  );
}
