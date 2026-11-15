import { notFound } from 'next/navigation';
import { UiGallery } from '@/components/app/UiGallery';

// Design-system gallery for checking every component at 390 px. Not part of the product.
export default function DevUiPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <UiGallery />;
}
