'use client';

/**
 * Canvas Text Element Component
 * @description Renders an editable text element on the Konva canvas with inline editing,
 * selection highlighting, and drag/resize transformation handles.
 * @module components/features/canvas-editor/canvas-text-element
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { Text, Transformer, Rect } from 'react-konva';
import type Konva from 'konva';
import type { CanvasTextElement as TextElementType } from '@/types/canvas-editor';

/**
 * Props for the CanvasTextElement component
 */
interface CanvasTextElementProps {
  element: TextElementType;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onChange: (updates: Partial<TextElementType>) => void;
}

/**
 * Canvas Text Element
 * Renders editable text with transformation handles
 */
export function CanvasTextElement({
  element,
  isSelected,
  onSelect,
  onChange,
}: CanvasTextElementProps) {
  const textRef = useRef<Konva.Text>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Cleanup textarea on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (textareaRef.current && textareaRef.current.parentNode) {
        textareaRef.current.parentNode.removeChild(textareaRef.current);
        textareaRef.current = null;
      }
    };
  }, []);

  // Attach transformer when selected
  useEffect(() => {
    if (isSelected && transformerRef.current && textRef.current) {
      transformerRef.current.nodes([textRef.current]);
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
   * Start inline text editing
   */
  const startEditing = useCallback(() => {
    setIsEditing(true);

    const textNode = textRef.current;
    if (!textNode) return;

    // Get stage and text position
    const stage = textNode.getStage();
    if (!stage) return;

    const textPosition = textNode.absolutePosition();
    const stageBox = stage.container().getBoundingClientRect();
    const scale = stage.scaleX();

    // Calculate position for the textarea
    const areaPosition = {
      x: stageBox.left + textPosition.x * scale,
      y: stageBox.top + textPosition.y * scale,
    };

    // Create textarea for editing
    const textarea = document.createElement('textarea');
    textareaRef.current = textarea;
    document.body.appendChild(textarea);

    textarea.value = element.text;
    textarea.style.position = 'fixed';
    textarea.style.top = `${areaPosition.y}px`;
    textarea.style.left = `${areaPosition.x}px`;
    textarea.style.width = `${element.width * scale}px`;
    textarea.style.height = `${element.height * scale}px`;
    textarea.style.fontSize = `${element.fontSize * scale}px`;
    textarea.style.fontFamily = element.fontFamily;
    textarea.style.fontWeight = element.fontWeight;
    textarea.style.color = element.fill;
    textarea.style.textAlign = element.align;
    textarea.style.border = '2px solid #3b82f6';
    textarea.style.borderRadius = '4px';
    textarea.style.padding = '4px';
    textarea.style.margin = '0';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'rgba(255, 255, 255, 0.95)';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.lineHeight = String(element.lineHeight || 1.2);
    textarea.style.transformOrigin = 'left top';
    textarea.style.zIndex = '10000';

    textarea.focus();
    textarea.select();

    // Handle blur to finish editing
    const handleBlur = () => {
      const newText = textarea.value;
      if (textarea.parentNode) {
        document.body.removeChild(textarea);
      }
      textareaRef.current = null;
      setIsEditing(false);
      onChange({ text: newText });
    };

    // Handle key events
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to cancel
      if (e.key === 'Escape') {
        if (textarea.parentNode) {
          document.body.removeChild(textarea);
        }
        textareaRef.current = null;
        setIsEditing(false);
        return;
      }
      // Enter without shift to finish editing
      if (e.key === 'Enter' && !e.shiftKey) {
        textarea.blur();
      }
    };

    textarea.addEventListener('blur', handleBlur);
    textarea.addEventListener('keydown', handleKeyDown);
  }, [element, onChange]);

  /**
   * Handle double click to start editing
   */
  const handleDblClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      startEditing();
    },
    [startEditing]
  );

  /**
   * Handle double tap (touch) to start editing
   */
  const handleDblTap = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      e.cancelBubble = true;
      startEditing();
    },
    [startEditing]
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
    const node = textRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Reset scale and update width
    node.scaleX(1);
    node.scaleY(1);

    onChange({
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      width: Math.round(Math.max(50, node.width() * scaleX)),
      height: Math.round(Math.max(20, node.height() * scaleY)),
      rotation: Math.round(node.rotation()),
    });
  }, [onChange]);

  return (
    <>
      {/* Text element */}
      <Text
        ref={textRef}
        id={element.id}
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        text={element.text}
        fontSize={element.fontSize}
        fontFamily={element.fontFamily}
        fontStyle={element.fontStyle || 'normal'}
        fontWeight={element.fontWeight === 'bold' ? 'bold' : 'normal'}
        fill={element.fill}
        align={element.align}
        verticalAlign="top"
        lineHeight={element.lineHeight || 1.2}
        letterSpacing={element.letterSpacing || 0}
        rotation={element.rotation}
        draggable={!isEditing}
        onClick={handleClick}
        onTap={handleTap}
        onDblClick={handleDblClick}
        onDblTap={handleDblTap}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        visible={!isEditing}
        opacity={element.opacity ?? 1}
      />

      {/* Selection outline when selected but not editing */}
      {isSelected && !isEditing && (
        <Rect
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          rotation={element.rotation}
          stroke="#3b82f6"
          strokeWidth={1}
          dash={[5, 5]}
          listening={false}
        />
      )}

      {/* Transformer for resizing/rotating */}
      {isSelected && !isEditing && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Limit resize to minimum size
            if (newBox.width < 50 || newBox.height < 20) {
              return oldBox;
            }
            return newBox;
          }}
          enabledAnchors={[
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right',
            'middle-left',
            'middle-right',
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
