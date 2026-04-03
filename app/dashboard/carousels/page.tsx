'use client';

/**
 * Carousels Page
 * @description Canvas-based carousel editor for designing multi-slide LinkedIn carousel posts
 * @module app/dashboard/carousels/page
 */

import { useSearchParams } from 'next/navigation';
import { PageContent } from "@/components/shared/page-content";
import { CanvasEditor } from '@/components/features/canvas-editor';
import { CarouselsSkeleton } from '@/components/skeletons/page-skeletons';
import { usePageLoading } from '@/hooks/use-minimum-loading';
import { usePageMeta } from '@/lib/dashboard-context';

/**
 * Carousels page content component with full-height canvas editor
 * @param props - Component props
 * @param props.draftId - Optional draft ID to restore from API
 */
function CarouselsContent({ draftId }: { draftId?: string }) {
  return (
    <PageContent className="h-[calc(100vh-var(--header-height))] gap-0 p-0 md:gap-0 md:p-0">
      <CanvasEditor draftId={draftId} />
    </PageContent>
  );
}

/**
 * Carousels page component
 * @returns Carousels page with interactive canvas-based carousel builder
 */
export default function CarouselsPage() {
  usePageMeta({ title: "Carousels" });
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draft') ?? undefined;
  const isLoading = usePageLoading(1000);

  return isLoading ? <CarouselsSkeleton /> : <CarouselsContent draftId={draftId} />;
}
