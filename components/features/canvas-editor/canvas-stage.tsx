'use client';

/**
 * Canvas Stage Component
 * @description Konva Stage wrapper that renders all slide elements (text, shapes, images)
 * with responsive sizing, optional grid overlay, zoom controls, and image drop support.
 * @module components/features/canvas-editor/canvas-stage
 */

import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer, Rect, Line } from 'react-konva';
import type Konva from 'konva';
import { CanvasTextElement } from './canvas-text-element';
import { CanvasShapeElement } from './canvas-shape-element';
import { CanvasImageElement } from './canvas-image-element';
import { toast } from 'sonner';
import type { CanvasSlide, CanvasElement, CANVAS_DIMENSIONS } from '@/types/canvas-editor';

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1080;
const GRID_SIZE = 40;

/**
 * Props for the CanvasStage component
 */
interface CanvasStageProps {
  slide: CanvasSlide;
  selectedElementId: string | null;
  onElementSelect: (id: string | null) => void;
  onElementUpdate: (elementId: string, updates: Partial<CanvasElement>) => void;
  zoom: number;
  showGrid: boolean;
  /** Callback when an image file is dropped onto the canvas */
  onImageDrop?: (src: string, width: number, height: number) => void;
}

/**
 * Ref type for accessing the Konva stage
 */
export interface CanvasStageRef {
  getStage: () => Konva.Stage | null;
}

/**
 * Canvas Stage Component
 * Renders the Konva canvas with all slide elements
 */
export const CanvasStage = forwardRef<CanvasStageRef, CanvasStageProps>(
  function CanvasStage(
    { slide, selectedElementId, onElementSelect, onElementUpdate, zoom, showGrid, onImageDrop },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage>(null);
    const [scale, setScale] = useState(1);
    const [isDragOver, setIsDragOver] = useState(false);

    // Expose stage ref to parent
    useImperativeHandle(ref, () => ({
      getStage: () => stageRef.current,
    }));

    // Calculate responsive scale
    useEffect(() => {
      const updateScale = () => {
        if (containerRef.current) {
          const containerWidth = containerRef.current.offsetWidth;
          const containerHeight = containerRef.current.offsetHeight;
          const scaleX = containerWidth / CANVAS_WIDTH;
          const scaleY = containerHeight / CANVAS_HEIGHT;
          const newScale = Math.min(scaleX, scaleY, 0.9) * zoom;
          setScale(newScale);
        }
      };

      updateScale();
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }, [zoom]);

    /**
     * Handle click on stage background to deselect
     */
    const handleStageClick = useCallback(
      (e: Konva.KonvaEventObject<MouseEvent>) => {
        // Only deselect if clicking directly on the stage background
        if (e.target === e.target.getStage()) {
          onElementSelect(null);
        }
      },
      [onElementSelect]
    );

    /**
     * Handle tap (touch) on stage background to deselect
     */
    const handleStageTap = useCallback(
      (e: Konva.KonvaEventObject<TouchEvent>) => {
        // Only deselect if tapping directly on the stage background
        if (e.target === e.target.getStage()) {
          onElementSelect(null);
        }
      },
      [onElementSelect]
    );

    /**
     * Handle element selection
     */
    const handleElementSelect = useCallback(
      (id: string) => {
        onElementSelect(id);
      },
      [onElementSelect]
    );

    /**
     * Handle element update
     */
    const handleElementChange = useCallback(
      (elementId: string, updates: Partial<CanvasElement>) => {
        onElementUpdate(elementId, updates);
      },
      [onElementUpdate]
    );

    /**
     * Handle dragover event on the canvas wrapper
     * Prevents default to allow drop and shows the drop indicator
     * @param e - The drag event from the wrapper div
     */
    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    }, []);

    /**
     * Handle dragleave event on the canvas wrapper
     * Hides the drop indicator when the dragged item leaves the area
     * @param e - The drag event from the wrapper div
     */
    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    }, []);

    /**
     * Handle drop event on the canvas wrapper
     * Reads dropped image files, converts to data URLs, and calculates
     * scaled dimensions before calling onImageDrop
     * @param e - The drag event containing the dropped files
     */
    const handleDrop = useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        if (!onImageDrop) return;

        const files = Array.from(e.dataTransfer.files);
        const imageFile = files.find((file) => file.type.startsWith('image/'));

        if (!imageFile) return;

        // Validate file size (max 5MB)
        if (imageFile.size > 5 * 1024 * 1024) {
          toast.error('File too large. Maximum size is 5MB.');
          return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          if (!dataUrl) return;

          const img = new window.Image();
          img.onload = () => {
            const maxSize = 500;
            let width = img.width;
            let height = img.height;

            if (width > maxSize || height > maxSize) {
              if (width > height) {
                height = (height / width) * maxSize;
                width = maxSize;
              } else {
                width = (width / height) * maxSize;
                height = maxSize;
              }
            }

            onImageDrop(dataUrl, Math.round(width), Math.round(height));
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(imageFile);
      },
      [onImageDrop]
    );

    /**
     * Render grid lines
     */
    const renderGrid = () => {
      if (!showGrid) return null;

      const lines = [];
      const gridColor = '#e5e7eb';

      // Vertical lines
      for (let i = 0; i <= CANVAS_WIDTH; i += GRID_SIZE) {
        lines.push(
          <Line
            key={`v-${i}`}
            points={[i, 0, i, CANVAS_HEIGHT]}
            stroke={gridColor}
            strokeWidth={0.5}
            listening={false}
          />
        );
      }

      // Horizontal lines
      for (let i = 0; i <= CANVAS_HEIGHT; i += GRID_SIZE) {
        lines.push(
          <Line
            key={`h-${i}`}
            points={[0, i, CANVAS_WIDTH, i]}
            stroke={gridColor}
            strokeWidth={0.5}
            listening={false}
          />
        );
      }

      return lines;
    };

    /**
     * Render elements based on their type
     */
    const renderElement = (element: CanvasElement) => {
      const isSelected = selectedElementId === element.id;

      switch (element.type) {
        case 'text':
          return (
            <CanvasTextElement
              key={element.id}
              element={element}
              isSelected={isSelected}
              onSelect={handleElementSelect}
              onChange={(updates) => handleElementChange(element.id, updates)}
            />
          );
        case 'shape':
          return (
            <CanvasShapeElement
              key={element.id}
              element={element}
              isSelected={isSelected}
              onSelect={handleElementSelect}
              onChange={(updates) => handleElementChange(element.id, updates)}
            />
          );
        case 'image':
          return (
            <CanvasImageElement
              key={element.id}
              element={element}
              isSelected={isSelected}
              onSelect={handleElementSelect}
              onChange={(updates) => handleElementChange(element.id, updates)}
            />
          );
        default:
          return null;
      }
    };

    return (
      <div
        ref={containerRef}
        className="relative flex h-full w-full items-center justify-center overflow-hidden bg-muted/30 p-4"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className="shadow-2xl"
          style={{
            width: CANVAS_WIDTH * scale,
            height: CANVAS_HEIGHT * scale,
          }}
        >
          <Stage
            ref={stageRef}
            width={CANVAS_WIDTH * scale}
            height={CANVAS_HEIGHT * scale}
            scaleX={scale}
            scaleY={scale}
            onClick={handleStageClick}
            onTap={handleStageTap}
          >
            <Layer>
              {/* Background */}
              <Rect
                x={0}
                y={0}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                fill={slide.backgroundColor}
                listening={false}
              />

              {/* Grid overlay */}
              {renderGrid()}

              {/* Elements (sorted by z-index if needed) */}
              {(slide.elements || []).map(renderElement)}
            </Layer>
          </Stage>
        </div>

        {/* Drag-and-drop overlay */}
        {isDragOver && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg">
            <div className="flex flex-col items-center gap-2 rounded-lg bg-background/90 px-6 py-4 shadow-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span className="text-sm font-medium text-primary">Drop image here</span>
            </div>
          </div>
        )}
      </div>
    );
  }
);
