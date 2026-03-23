/**
 * Canvas PDF Export Utility
 * @description Handles exporting carousel slides to PDF format using pdf-lib and Konva stage snapshots
 * @module lib/canvas-pdf-export
 */

import { PDFDocument, rgb } from 'pdf-lib';
import type Konva from 'konva';
import type { CanvasSlide, ExportOptions, CANVAS_DIMENSIONS } from '@/types/canvas-editor';

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1080;

/**
 * Convert a data URL to a Uint8Array
 * @param dataUrl - Base64 data URL
 * @returns Uint8Array of the image data
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Get pixel ratio based on export quality
 * @param quality - Export quality setting
 * @returns Pixel ratio for export
 */
function getPixelRatio(quality: ExportOptions['quality']): number {
  switch (quality) {
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
      return 3;
    default:
      return 2;
  }
}

/**
 * Export a single slide to PNG data URL
 * @param stage - Konva stage reference
 * @param pixelRatio - Pixel ratio for export quality
 * @returns PNG data URL
 */
export function exportSlideToDataUrl(
  stage: Konva.Stage,
  pixelRatio: number = 2
): string {
  return stage.toDataURL({
    pixelRatio,
    mimeType: 'image/png',
  });
}

/**
 * Export carousel slides to a multi-page PDF
 * @param slideDataUrls - Array of PNG data URLs for each slide
 * @param options - Export options
 * @param onProgress - Progress callback (0-1)
 * @returns PDF Blob
 */
export async function exportCarouselToPDF(
  slideDataUrls: string[],
  options: ExportOptions,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < slideDataUrls.length; i++) {
    const dataUrl = slideDataUrls[i];

    // Report progress
    if (onProgress) {
      onProgress((i + 0.5) / slideDataUrls.length);
    }

    try {
      // Convert data URL to bytes
      const imageBytes = dataUrlToUint8Array(dataUrl);

      // Embed the PNG image
      const image = await pdfDoc.embedPng(imageBytes);

      // Add a page with LinkedIn carousel dimensions (square)
      const page = pdfDoc.addPage([CANVAS_WIDTH, CANVAS_HEIGHT]);

      // Draw the image on the page
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
      });
    } catch (error) {
      console.error(`Error processing slide ${i + 1}:`, error);
      // Add a blank page with error message if image fails
      const page = pdfDoc.addPage([CANVAS_WIDTH, CANVAS_HEIGHT]);
      page.drawText(`Error loading slide ${i + 1}`, {
        x: CANVAS_WIDTH / 2 - 100,
        y: CANVAS_HEIGHT / 2,
        size: 24,
        color: rgb(1, 0, 0),
      });
    }

    // Report progress
    if (onProgress) {
      onProgress((i + 1) / slideDataUrls.length);
    }
  }

  // Generate PDF bytes
  const pdfBytes = await pdfDoc.save();

  // Convert to standard Uint8Array for Blob constructor compatibility
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

/**
 * Export a single slide to PNG Blob
 * @param stage - Konva stage reference
 * @param quality - Export quality
 * @returns PNG Blob
 */
export async function exportSlideToPNG(
  stage: Konva.Stage,
  quality: ExportOptions['quality'] = 'high'
): Promise<Blob> {
  const pixelRatio = getPixelRatio(quality);
  const dataUrl = exportSlideToDataUrl(stage, pixelRatio);

  // Convert data URL to Blob
  const response = await fetch(dataUrl);
  return response.blob();
}

/**
 * Download a Blob as a file
 * @param blob - Blob to download
 * @param filename - Name for the downloaded file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate a filename with timestamp
 * @param prefix - Filename prefix
 * @param extension - File extension
 * @returns Generated filename
 */
export function generateFilename(prefix: string, extension: string): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${timestamp}.${extension}`;
}

/**
 * Export options helper
 */
export const defaultExportOptions: ExportOptions = {
  format: 'pdf',
  quality: 'high',
  pixelRatio: 2,
  fileName: undefined,
};
