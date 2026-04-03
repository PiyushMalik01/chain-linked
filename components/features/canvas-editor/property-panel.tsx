'use client';

/**
 * Property Panel Component
 * Right sidebar for editing element and slide properties
 * Features collapsible sections, font previews, visual alignment buttons,
 * and improved typography controls with proper spacing and organization
 * Uses EnhancedColorPicker and supports image tint colors
 * @module components/features/canvas-editor/property-panel
 */

import React, { useState, useCallback } from 'react';
import {
  IconTypography,
  IconSquare,
  IconPhoto,
  IconTrash,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconLoader2,
  IconScissors,
  IconCheck,
  IconTemplate,
  IconSparkles,
  IconUpload,
  IconLayoutList,
  IconPalette,
  IconChevronDown,
  IconChevronRight,
  IconDimensions,
  IconRotate,
  IconEye,
  IconTextSize,
  IconLineHeight,
  IconLetterSpacing,
  IconBold,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { removeImageBackground, type RemovalProgress } from '@/lib/image/background-removal';
import { EnhancedColorPicker } from './enhanced-color-picker';
import type {
  CanvasElement,
  CanvasSlide,
  CanvasTextElement,
  CanvasShapeElement,
  CanvasImageElement,
  ElementType,
  TextAlign,
  LeftPanelTab,
} from '@/types/canvas-editor';

/**
 * Available font options for text elements
 */
const FONT_OPTIONS = [
  'Inter',
  'Playfair Display',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Lato',
  'Poppins',
  'Raleway',
];

/**
 * Font weight options with labels
 */
const FONT_WEIGHTS = [
  { label: 'Light', value: '300' },
  { label: 'Normal', value: 'normal' },
  { label: 'Medium', value: '500' },
  { label: 'Semi Bold', value: '600' },
  { label: 'Bold', value: 'bold' },
];

/**
 * Collapsible section component for organizing property groups
 * Provides a clickable header that toggles visibility of section content
 * @param props - Component props
 * @param props.title - Section title displayed in the header
 * @param props.icon - Optional icon displayed before the title
 * @param props.defaultOpen - Whether the section starts expanded (default: true)
 * @param props.children - Section content to show/hide
 * @returns Collapsible section JSX
 */
function PropertySection({
  title,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="flex items-center gap-1.5">
          {icon}
          {title}
        </span>
        {isOpen ? (
          <IconChevronDown className="h-3.5 w-3.5" />
        ) : (
          <IconChevronRight className="h-3.5 w-3.5" />
        )}
      </button>
      {isOpen && (
        <div className="space-y-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Props for the PropertyPanel component
 * @property selectedElement - Currently selected canvas element
 * @property currentSlide - The current active slide
 * @property templateColors - Brand/template colors for the color picker
 * @property onElementUpdate - Callback when element properties change
 * @property onSlideBackgroundChange - Callback when slide background changes
 * @property onAddElement - Callback to add a new element
 * @property onAddImageElement - Optional callback to add an image element
 * @property onDeleteElement - Callback to delete the selected element
 * @property onSwitchLeftTab - Callback to switch the left panel tab
 */
interface PropertyPanelProps {
  selectedElement: CanvasElement | null;
  currentSlide: CanvasSlide | undefined;
  templateColors: string[];
  onElementUpdate: (updates: Partial<CanvasElement>) => void;
  onSlideBackgroundChange: (color: string) => void;
  onAddElement: (type: ElementType) => void;
  onAddImageElement?: (src: string, width?: number, height?: number) => void;
  onDeleteElement: () => void;
  /** Callback to switch the left panel to a specific tab */
  onSwitchLeftTab?: (tab: LeftPanelTab) => void;
}

/**
 * Property Panel Component
 * Displays context-aware properties for the selected element or slide
 * Features collapsible sections, visual controls, and polished layout
 * @param props - Component props
 * @returns Property panel JSX
 */
export function PropertyPanel({
  selectedElement,
  currentSlide,
  templateColors,
  onElementUpdate,
  onSlideBackgroundChange,
  onAddElement,
  onAddImageElement,
  onDeleteElement,
  onSwitchLeftTab,
}: PropertyPanelProps) {
  return (
    <div className="flex min-h-0 w-72 flex-1 flex-col border-l bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="text-sm font-semibold">Properties</span>
        {selectedElement && (
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5">
            {selectedElement.type === 'text' && <IconTypography className="h-3 w-3 text-muted-foreground" />}
            {selectedElement.type === 'shape' && <IconSquare className="h-3 w-3 text-muted-foreground" />}
            {selectedElement.type === 'image' && <IconPhoto className="h-3 w-3 text-muted-foreground" />}
            <span className="text-[11px] capitalize text-muted-foreground">{selectedElement.type}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="element" className="flex h-full w-full flex-col">
          <TabsList className="mx-4 mt-3 grid w-[calc(100%-2rem)] shrink-0 grid-cols-2">
            <TabsTrigger value="element">Element</TabsTrigger>
            <TabsTrigger value="slide">Slide</TabsTrigger>
          </TabsList>

          {/* Element Properties */}
          <TabsContent value="element" className="flex-1 overflow-hidden mt-0 p-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                {selectedElement ? (
                  <div className="space-y-1">
                    {/* Text-specific properties */}
                    {selectedElement.type === 'text' && (
                      <TextProperties
                        element={selectedElement as CanvasTextElement}
                        onChange={onElementUpdate}
                        templateColors={templateColors}
                      />
                    )}

                    {/* Shape-specific properties */}
                    {selectedElement.type === 'shape' && (
                      <ShapeProperties
                        element={selectedElement as CanvasShapeElement}
                        onChange={onElementUpdate}
                        templateColors={templateColors}
                      />
                    )}

                    {/* Image-specific properties */}
                    {selectedElement.type === 'image' && (
                      <ImageProperties
                        element={selectedElement as CanvasImageElement}
                        onChange={onElementUpdate}
                        templateColors={templateColors}
                      />
                    )}

                    <Separator className="my-1" />

                    {/* Common properties */}
                    <CommonProperties
                      element={selectedElement}
                      onChange={onElementUpdate}
                    />

                    <Separator className="my-1" />

                    {/* Delete button */}
                    <div className="pt-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={() => onDeleteElement()}
                      >
                        <IconTrash className="mr-2 h-3.5 w-3.5" />
                        Delete Element
                      </Button>
                    </div>
                  </div>
                ) : (
                  <NoElementSelected
                    onAddElement={onAddElement}
                    onSwitchLeftTab={onSwitchLeftTab}
                  />
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Slide Properties */}
          <TabsContent value="slide" className="flex-1 overflow-hidden mt-0 p-0">
            <ScrollArea className="h-full">
              <div className="space-y-1 p-4">
                <PropertySection
                  title="Background"
                  icon={<IconPalette className="h-3 w-3" />}
                >
                  <EnhancedColorPicker
                    color={currentSlide?.backgroundColor ?? '#FFFFFF'}
                    onChange={onSlideBackgroundChange}
                    templateColors={templateColors}
                  />
                </PropertySection>

                <Separator className="my-1" />

                <PropertySection title="Quick Add">
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAddElement('text')}
                      className="flex flex-col gap-1 h-auto py-3 hover:border-primary/30 hover:bg-primary/5"
                    >
                      <IconTypography className="h-5 w-5" />
                      <span className="text-xs">Text</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAddElement('shape')}
                      className="flex flex-col gap-1 h-auto py-3 hover:border-primary/30 hover:bg-primary/5"
                    >
                      <IconSquare className="h-5 w-5" />
                      <span className="text-xs">Shape</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSwitchLeftTab?.('uploads')}
                      className="flex flex-col gap-1 h-auto py-3 hover:border-primary/30 hover:bg-primary/5"
                    >
                      <IconUpload className="h-5 w-5" />
                      <span className="text-xs">Upload</span>
                    </Button>
                  </div>
                </PropertySection>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/**
 * No element selected state with helpful quick-links
 * Shows an empty state message with quick-add buttons and panel shortcuts
 * @param props - Component props
 * @param props.onAddElement - Callback to add a new element
 * @param props.onSwitchLeftTab - Callback to switch the left panel tab
 * @returns Empty state JSX with quick actions
 */
function NoElementSelected({
  onAddElement,
  onSwitchLeftTab,
}: {
  onAddElement: (type: ElementType) => void;
  onSwitchLeftTab?: (tab: LeftPanelTab) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Empty state message */}
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <IconTypography className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          No element selected
        </p>
        <p className="text-xs text-muted-foreground/60">
          Click an element on the canvas to edit
        </p>
      </div>

      {/* Quick add element buttons */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Add
        </Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddElement('text')}
            className="flex flex-col gap-1 h-auto py-3 hover:border-primary/30 hover:bg-primary/5"
          >
            <IconTypography className="h-5 w-5" />
            <span className="text-xs">Text</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddElement('shape')}
            className="flex flex-col gap-1 h-auto py-3 hover:border-primary/30 hover:bg-primary/5"
          >
            <IconSquare className="h-5 w-5" />
            <span className="text-xs">Shape</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSwitchLeftTab?.('uploads')}
            className="flex flex-col gap-1 h-auto py-3 hover:border-primary/30 hover:bg-primary/5"
          >
            <IconUpload className="h-5 w-5" />
            <span className="text-xs">Upload</span>
          </Button>
        </div>
      </div>

      {/* Quick-link buttons to left panel tabs */}
      {onSwitchLeftTab && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Open Panel
          </Label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onSwitchLeftTab('templates')}
              className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <IconTemplate className="h-3.5 w-3.5" />
              Templates
            </button>
            <button
              type="button"
              onClick={() => onSwitchLeftTab('ai')}
              className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <IconSparkles className="h-3.5 w-3.5" />
              AI Generate
            </button>
            <button
              type="button"
              onClick={() => onSwitchLeftTab('graphics')}
              className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <IconPhoto className="h-3.5 w-3.5" />
              Graphics
            </button>
            <button
              type="button"
              onClick={() => onSwitchLeftTab('slides')}
              className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <IconLayoutList className="h-3.5 w-3.5" />
              Slides
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Text element properties with organized collapsible sections
 * Includes typography, color, alignment, and spacing controls
 * @param props - Component props
 * @param props.element - The text element to edit
 * @param props.onChange - Callback when properties change
 * @param props.templateColors - Template brand colors for the picker
 * @returns Text properties JSX
 */
function TextProperties({
  element,
  onChange,
  templateColors,
}: {
  element: CanvasTextElement;
  onChange: (updates: Partial<CanvasTextElement>) => void;
  templateColors: string[];
}) {
  return (
    <div className="space-y-1">
      {/* Typography section */}
      <PropertySection
        title="Typography"
        icon={<IconTypography className="h-3 w-3" />}
      >
        {/* Font Family with preview */}
        <div className="space-y-1.5">
          <Label className="text-xs">Font Family</Label>
          <Select
            value={element.fontFamily}
            onValueChange={(value) => onChange({ fontFamily: value })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((font) => (
                <SelectItem key={font} value={font}>
                  <span style={{ fontFamily: font }} className="text-sm">
                    {font}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Font Size & Weight row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 text-xs">
              <IconTextSize className="h-3 w-3 text-muted-foreground" />
              Size
            </Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={element.fontSize}
                onChange={(e) => onChange({ fontSize: parseInt(e.target.value) || 16 })}
                min={8}
                max={200}
                className="h-8"
              />
              <span className="text-[10px] text-muted-foreground">px</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 text-xs">
              <IconBold className="h-3 w-3 text-muted-foreground" />
              Weight
            </Label>
            <Select
              value={element.fontWeight}
              onValueChange={(value) => onChange({ fontWeight: value as CanvasTextElement['fontWeight'] })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_WEIGHTS.map(({ label, value }) => (
                  <SelectItem key={value} value={value}>
                    <span style={{ fontWeight: value }}>{label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PropertySection>

      {/* Color section */}
      <PropertySection
        title="Color"
        icon={<IconPalette className="h-3 w-3" />}
      >
        <EnhancedColorPicker
          color={element.fill}
          onChange={(color) => onChange({ fill: color })}
          templateColors={templateColors}
        />
      </PropertySection>

      {/* Alignment section */}
      <PropertySection
        title="Alignment"
        icon={<IconAlignLeft className="h-3 w-3" />}
      >
        <div className="flex gap-1">
          {(['left', 'center', 'right'] as TextAlign[]).map((align) => (
            <Button
              key={align}
              variant={element.align === align ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'flex-1 transition-all',
                element.align === align
                  ? 'shadow-sm'
                  : 'hover:border-primary/30 hover:bg-primary/5'
              )}
              onClick={() => onChange({ align })}
            >
              {align === 'left' && <IconAlignLeft className="h-4 w-4" />}
              {align === 'center' && <IconAlignCenter className="h-4 w-4" />}
              {align === 'right' && <IconAlignRight className="h-4 w-4" />}
            </Button>
          ))}
        </div>
      </PropertySection>

      {/* Spacing section */}
      <PropertySection
        title="Spacing"
        icon={<IconLineHeight className="h-3 w-3" />}
        defaultOpen={false}
      >
        {/* Line Height */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1 text-xs">
              <IconLineHeight className="h-3 w-3 text-muted-foreground" />
              Line Height
            </Label>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {(element.lineHeight || 1.2).toFixed(1)}
            </span>
          </div>
          <Slider
            value={[element.lineHeight || 1.2]}
            onValueChange={([value]) => onChange({ lineHeight: value })}
            min={0.8}
            max={3}
            step={0.1}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground/50">
            <span>Tight</span>
            <span>Loose</span>
          </div>
        </div>

        {/* Letter Spacing */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1 text-xs">
              <IconLetterSpacing className="h-3 w-3 text-muted-foreground" />
              Letter Spacing
            </Label>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {(element.letterSpacing || 0).toFixed(1)}px
            </span>
          </div>
          <Slider
            value={[element.letterSpacing || 0]}
            onValueChange={([value]) => onChange({ letterSpacing: value })}
            min={-2}
            max={10}
            step={0.5}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground/50">
            <span>Tight</span>
            <span>Wide</span>
          </div>
        </div>
      </PropertySection>
    </div>
  );
}

/**
 * Shape element properties with organized collapsible sections
 * @param props - Component props
 * @param props.element - The shape element to edit
 * @param props.onChange - Callback when properties change
 * @param props.templateColors - Template brand colors for the picker
 * @returns Shape properties JSX
 */
function ShapeProperties({
  element,
  onChange,
  templateColors,
}: {
  element: CanvasShapeElement;
  onChange: (updates: Partial<CanvasShapeElement>) => void;
  templateColors: string[];
}) {
  return (
    <div className="space-y-1">
      {/* Shape Type */}
      <PropertySection
        title="Shape"
        icon={<IconSquare className="h-3 w-3" />}
      >
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select
            value={element.shapeType}
            onValueChange={(value) => onChange({ shapeType: value as CanvasShapeElement['shapeType'] })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rect">Rectangle</SelectItem>
              <SelectItem value="circle">Circle</SelectItem>
              <SelectItem value="line">Line</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PropertySection>

      {/* Fill Color */}
      <PropertySection
        title="Fill"
        icon={<IconPalette className="h-3 w-3" />}
      >
        <EnhancedColorPicker
          color={element.fill}
          onChange={(color) => onChange({ fill: color })}
          templateColors={templateColors}
        />
      </PropertySection>

      {/* Border section */}
      <PropertySection
        title="Border"
        defaultOpen={Boolean(element.strokeWidth && element.strokeWidth > 0)}
      >
        {/* Corner Radius (for rectangles) */}
        {element.shapeType === 'rect' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Corner Radius</Label>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                {element.cornerRadius || 0}px
              </span>
            </div>
            <Slider
              value={[element.cornerRadius || 0]}
              onValueChange={([value]) => onChange({ cornerRadius: value })}
              min={0}
              max={200}
              step={1}
            />
          </div>
        )}

        {/* Stroke Width */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Stroke Width</Label>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {element.strokeWidth || 0}px
            </span>
          </div>
          <Slider
            value={[element.strokeWidth || 0]}
            onValueChange={([value]) => onChange({ strokeWidth: value })}
            min={0}
            max={20}
            step={1}
          />
        </div>

        {/* Stroke Color */}
        {(element.strokeWidth || 0) > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Stroke Color</Label>
            <EnhancedColorPicker
              color={element.stroke || '#000000'}
              onChange={(color) => onChange({ stroke: color })}
              templateColors={templateColors}
            />
          </div>
        )}
      </PropertySection>
    </div>
  );
}

/**
 * Image element properties with tint color support
 * Features background removal, image replacement, and tint controls
 * @param props - Component props
 * @param props.element - The image element to edit
 * @param props.onChange - Callback when properties change
 * @param props.templateColors - Template brand colors for the picker
 * @returns Image properties JSX
 */
function ImageProperties({
  element,
  onChange,
  templateColors,
}: {
  element: CanvasImageElement;
  onChange: (updates: Partial<CanvasImageElement>) => void;
  templateColors: string[];
}) {
  const [bgRemovalState, setBgRemovalState] = useState<
    'idle' | 'uploading' | 'processing' | 'done'
  >('idle');
  const [bgRemovalProgress, setBgRemovalProgress] = useState(0);
  const bgResetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (bgResetTimerRef.current) {
        clearTimeout(bgResetTimerRef.current);
      }
    };
  }, []);

  /**
   * Handle background removal for the image
   */
  const handleRemoveBackground = useCallback(async () => {
    if (!element.src || bgRemovalState !== 'idle') return;

    setBgRemovalState('uploading');
    setBgRemovalProgress(0);

    try {
      const resultDataUrl = await removeImageBackground(
        element.src,
        (p: RemovalProgress) => {
          setBgRemovalState(p.phase);
          setBgRemovalProgress(Math.round(p.progress * 100));
        },
      );

      onChange({ src: resultDataUrl });
      setBgRemovalState('done');
      toast.success('Background removed successfully');

      if (bgResetTimerRef.current) {
        clearTimeout(bgResetTimerRef.current);
      }
      bgResetTimerRef.current = setTimeout(() => {
        setBgRemovalState('idle');
        bgResetTimerRef.current = null;
      }, 2000);
    } catch (err) {
      console.error('[BgRemoval] Failed:', err);
      toast.error('Failed to remove background. Try a different image.');
      setBgRemovalState('idle');
    }
  }, [element.src, bgRemovalState, onChange]);

  const isBusy = bgRemovalState === 'uploading' || bgRemovalState === 'processing';

  // Show tint for small images (icons) or SVG data URLs
  const isIcon =
    (element.width <= 120 && element.height <= 120) ||
    element.src?.startsWith('data:image/svg');

  return (
    <div className="space-y-1">
      {/* Image Preview */}
      {element.src && (
        <PropertySection
          title="Preview"
          icon={<IconPhoto className="h-3 w-3" />}
        >
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={element.src}
              alt={element.alt || 'Preview'}
              className="h-full w-full object-contain"
            />
          </div>
        </PropertySection>
      )}

      {/* Alt Text */}
      <PropertySection title="Accessibility">
        <div className="space-y-1.5">
          <Label className="text-xs">Alt Text</Label>
          <Input
            type="text"
            value={element.alt || ''}
            onChange={(e) => onChange({ alt: e.target.value })}
            placeholder="Describe the image"
            className="h-8"
          />
        </div>
      </PropertySection>

      {/* Tint Color (for icons/small images) */}
      {isIcon && (
        <PropertySection
          title="Tint Color"
          icon={<IconPalette className="h-3 w-3" />}
        >
          <div className="space-y-1.5">
            {element.tintColor && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onChange({ tintColor: undefined })}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear tint
                </button>
              </div>
            )}
            <EnhancedColorPicker
              color={element.tintColor || '#000000'}
              onChange={(color) => onChange({ tintColor: color })}
              templateColors={templateColors}
            />
          </div>
        </PropertySection>
      )}

      {/* Actions */}
      <PropertySection title="Actions">
        {/* Remove Background */}
        {element.src && (
          <div className="space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleRemoveBackground}
              disabled={isBusy}
            >
              {bgRemovalState === 'idle' && (
                <>
                  <IconScissors className="mr-2 h-4 w-4" />
                  Remove Background
                </>
              )}
              {bgRemovalState === 'uploading' && (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading... {bgRemovalProgress}%
                </>
              )}
              {bgRemovalState === 'processing' && (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing... {bgRemovalProgress}%
                </>
              )}
              {bgRemovalState === 'done' && (
                <>
                  <IconCheck className="mr-2 h-4 w-4" />
                  Done!
                </>
              )}
            </Button>
            {isBusy && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-300"
                  style={{ width: `${bgRemovalProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Replace Image */}
        <Button
          variant="outline"
          size="sm"
          asChild
          className="w-full cursor-pointer"
        >
          <label>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (ev) => {
                  const dataUrl = ev.target?.result as string;
                  if (dataUrl) {
                    onChange({ src: dataUrl });
                  }
                };
                reader.readAsDataURL(file);
                e.target.value = '';
              }}
            />
            <IconPhoto className="mr-2 h-4 w-4" />
            Choose New Image
          </label>
        </Button>
      </PropertySection>
    </div>
  );
}

/**
 * Common element properties (position, size, rotation, opacity)
 * Organized in collapsible sections with proper labels and icons
 * @param props - Component props
 * @param props.element - The element to edit
 * @param props.onChange - Callback when properties change
 * @returns Common properties JSX
 */
function CommonProperties({
  element,
  onChange,
}: {
  element: CanvasElement;
  onChange: (updates: Partial<CanvasElement>) => void;
}) {
  return (
    <div className="space-y-1">
      {/* Position & Size */}
      <PropertySection
        title="Transform"
        icon={<IconDimensions className="h-3 w-3" />}
        defaultOpen={false}
      >
        {/* Position */}
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Position</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">X</Label>
              <Input
                type="number"
                value={Math.round(element.x)}
                onChange={(e) => onChange({ x: parseInt(e.target.value) || 0 })}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Y</Label>
              <Input
                type="number"
                value={Math.round(element.y)}
                onChange={(e) => onChange({ y: parseInt(e.target.value) || 0 })}
                className="h-7 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Size */}
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Size</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">W</Label>
              <Input
                type="number"
                value={Math.round(element.width)}
                onChange={(e) => onChange({ width: parseInt(e.target.value) || 100 })}
                min={10}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">H</Label>
              <Input
                type="number"
                value={Math.round(element.height)}
                onChange={(e) => onChange({ height: parseInt(e.target.value) || 100 })}
                min={10}
                className="h-7 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Rotation */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1 text-xs">
              <IconRotate className="h-3 w-3 text-muted-foreground" />
              Rotation
            </Label>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {element.rotation}&deg;
            </span>
          </div>
          <Slider
            value={[element.rotation]}
            onValueChange={([value]) => onChange({ rotation: value })}
            min={-180}
            max={180}
            step={1}
          />
        </div>
      </PropertySection>

      {/* Opacity */}
      <PropertySection
        title="Appearance"
        icon={<IconEye className="h-3 w-3" />}
        defaultOpen={false}
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Opacity</Label>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {Math.round((element.opacity ?? 1) * 100)}%
            </span>
          </div>
          <Slider
            value={[(element.opacity ?? 1) * 100]}
            onValueChange={([value]) => onChange({ opacity: value / 100 })}
            min={0}
            max={100}
            step={1}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground/50">
            <span>Transparent</span>
            <span>Opaque</span>
          </div>
        </div>
      </PropertySection>
    </div>
  );
}
