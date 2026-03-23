'use client';

/**
 * Export Dialog Component
 * @description Modal dialog for configuring carousel export settings (format, quality)
 * and initiating the PDF/image export with a progress indicator.
 * @module components/features/canvas-editor/export-dialog
 */

import { useState } from 'react';
import {
  IconFileTypePdf,
  IconPhoto,
  IconDownload,
  IconLoader2,
} from '@tabler/icons-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ExportOptions, ExportFormat } from '@/types/canvas-editor';

/**
 * Props for the ExportDialog component
 */
interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: ExportOptions) => void;
  isExporting: boolean;
  slideCount: number;
  exportProgress?: number;
}

/**
 * Quality option configuration
 */
const qualityOptions: {
  value: ExportOptions['quality'];
  label: string;
  description: string;
  pixelRatio: number;
}[] = [
  {
    value: 'low',
    label: 'Standard',
    description: 'Good for web sharing',
    pixelRatio: 1,
  },
  {
    value: 'medium',
    label: 'High',
    description: 'Recommended for LinkedIn',
    pixelRatio: 2,
  },
  {
    value: 'high',
    label: 'Maximum',
    description: 'Best for printing',
    pixelRatio: 3,
  },
];

/**
 * Format option configuration
 */
const formatOptions: {
  value: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'pdf',
    label: 'PDF Document',
    description: 'Multi-page document for LinkedIn carousels',
    icon: <IconFileTypePdf className="h-8 w-8" />,
  },
  {
    value: 'png',
    label: 'PNG Images',
    description: 'Individual images for each slide',
    icon: <IconPhoto className="h-8 w-8" />,
  },
];

/**
 * Export Dialog Component
 * Handles export format and quality selection
 */
export function ExportDialog({
  open,
  onOpenChange,
  onExport,
  isExporting,
  slideCount,
  exportProgress = 0,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [quality, setQuality] = useState<ExportOptions['quality']>('medium');

  /**
   * Handle export button click
   */
  const handleExport = () => {
    const selectedQuality = qualityOptions.find((q) => q.value === quality);
    onExport({
      format,
      quality,
      pixelRatio: selectedQuality?.pixelRatio ?? 2,
    });
  };

  return (
    <Dialog open={open} onOpenChange={isExporting ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Carousel</DialogTitle>
          <DialogDescription>
            Export your {slideCount}-slide carousel for LinkedIn.
          </DialogDescription>
        </DialogHeader>

        {isExporting ? (
          // Export progress view
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-4">
              <IconLoader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Exporting your carousel...</p>
                <p className="text-sm text-muted-foreground">
                  Processing {slideCount} slides
                </p>
              </div>
            </div>
            <Progress value={exportProgress * 100} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">
              {Math.round(exportProgress * 100)}% complete
            </p>
          </div>
        ) : (
          // Export options view
          <div className="space-y-6 py-4">
            {/* Format selection */}
            <div className="space-y-3">
              <Label>Format</Label>
              <div className="grid grid-cols-2 gap-3">
                {formatOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormat(option.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all',
                      format === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div
                      className={cn(
                        'text-muted-foreground',
                        format === option.value && 'text-primary'
                      )}
                    >
                      {option.icon}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quality selection */}
            <div className="space-y-3">
              <Label>Quality</Label>
              <RadioGroup
                value={quality}
                onValueChange={(value) =>
                  setQuality(value as ExportOptions['quality'])
                }
                className="space-y-2"
              >
                {qualityOptions.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-all',
                      quality === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={option.value} />
                      <div>
                        <p className="text-sm font-medium">{option.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {option.pixelRatio}x
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {/* Export info */}
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Tip:</strong> For LinkedIn carousels, export as PDF with
                High quality. LinkedIn supports PDF documents up to 100MB.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {!isExporting && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleExport}>
                <IconDownload className="mr-2 h-4 w-4" />
                Export {format.toUpperCase()}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
