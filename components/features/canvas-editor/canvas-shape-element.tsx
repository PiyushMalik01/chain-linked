'use client';

/**
 * Canvas Shape Element Component
 * @description Renders shape elements (rectangles, circles, lines) on the Konva canvas
 * with selection highlighting and drag/resize transformation handles.
 * @module components/features/canvas-editor/canvas-shape-element
 */

import { useRef, useEffect, useCallback } from 'react';
import { Rect, Circle, Line, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { CanvasShapeElement as ShapeElementType } from '@/types/canvas-editor';

/**
 * Props for the CanvasShapeElement component
 */
interface CanvasShapeElementProps {
  element: ShapeElementType;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onChange: (updates: Partial<ShapeElementType>) => void;
}

/**
 * Canvas Shape Element
 * Renders shapes with transformation handles
 */
export function CanvasShapeElement({
  element,
  isSelected,
  onSelect,
  onChange,
}: CanvasShapeElementProps) {
  const shapeRef = useRef<Konva.Rect | Konva.Circle | Konva.Line>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  // Attach transformer when selected
  useEffect(() => {
    if (isSelected && transformerRef.current && shapeRef.current) {
      transformerRef.current.nodes([shapeRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  /**
   * Handle click to select element
   */
  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onSelect(element.id);
    },
    [element.id, onSelect]
  );

  /**
   * Handle tap (touch) to select element
   */
  const handleTap = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      e.cancelBubble = true;
      onSelect(element.id);
    },
    [element.id, onSelect]
  );

  /**
   * Handle drag end to update position
   */
  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      onChange({
        x: Math.round(e.target.x()),
        y: Math.round(e.target.y()),
      });
    },
    [onChange]
  );

  /**
   * Handle transform end to update size and rotation
   */
  const handleTransformEnd = useCallback(() => {
    const node = shapeRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale and update dimensions
    node.scaleX(1);
    node.scaleY(1);

    if (element.shapeType === 'circle') {
      // For circles, use average of width/height for radius
      const newRadius = Math.max(
        10,
        ((element.width * scaleX + element.height * scaleY) / 2) / 2
      );
      onChange({
        x: Math.round(node.x()),
        y: Math.round(node.y()),
        width: Math.round(newRadius * 2),
        height: Math.round(newRadius * 2),
        rotation: Math.round(node.rotation()),
      });
    } else {
      onChange({
        x: Math.round(node.x()),
        y: Math.round(node.y()),
        width: Math.round(Math.max(10, element.width * scaleX)),
        height: Math.round(Math.max(10, element.height * scaleY)),
        rotation: Math.round(node.rotation()),
      });
    }
  }, [element.shapeType, element.width, element.height, onChange]);

  /**
   * Common props for all shapes
   */
  const commonProps = {
    ref: shapeRef as React.RefObject<Konva.Shape>,
    id: element.id,
    x: element.x,
    y: element.y,
    rotation: element.rotation,
    fill: element.fill,
    stroke: element.stroke,
    strokeWidth: element.strokeWidth || 0,
    draggable: true,
    onClick: handleClick,
    onTap: handleTap,
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd,
    opacity: element.opacity ?? 1,
  };

  /**
   * Render shape based on type
   */
  const renderShape = () => {
    switch (element.shapeType) {
      case 'rect':
        return (
          <Rect
            {...commonProps}
            ref={shapeRef as React.RefObject<Konva.Rect>}
            width={element.width}
            height={element.height}
            cornerRadius={element.cornerRadius || 0}
          />
        );

      case 'circle':
        return (
          <Circle
            {...commonProps}
            ref={shapeRef as React.RefObject<Konva.Circle>}
            // Offset to make x,y the top-left corner
            offsetX={-element.width / 2}
            offsetY={-element.height / 2}
            radius={Math.min(element.width, element.height) / 2}
          />
        );

      case 'line':
        return (
          <Line
            {...commonProps}
            ref={shapeRef as React.RefObject<Konva.Line>}
            points={[0, 0, element.width, element.height]}
            stroke={element.fill}
            strokeWidth={element.strokeWidth || 2}
            lineCap="round"
            lineJoin="round"
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      {renderShape()}

      {/* Transformer for resizing/rotating */}
      {isSelected && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Limit resize to minimum size
            if (newBox.width < 10 || newBox.height < 10) {
              return oldBox;
            }
            return newBox;
          }}
          enabledAnchors={[
            'top-left',
            'top-center',
            'top-right',
            'middle-right',
            'bottom-right',
            'bottom-center',
            'bottom-left',
            'middle-left',
          ]}
          rotateEnabled={true}
          borderStroke="#3b82f6"
          borderStrokeWidth={1}
          anchorStroke="#3b82f6"
          anchorFill="#ffffff"
          anchorSize={10}
          anchorCornerRadius={2}
        />
      )}
    </>
  );
}
