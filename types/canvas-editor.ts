/**
 * Canvas Editor Type Definitions
 * @description Types for the Canva-style carousel template editor including slides, elements,
 * templates, and editor state management
 * @module types/canvas-editor
 */

/**
 * Supported text alignment options
 */
export type TextAlign = 'left' | 'center' | 'right';

/**
 * Supported shape types for canvas elements
 */
export type ShapeType = 'rect' | 'circle' | 'line';

/**
 * Canvas element types
 */
export type ElementType = 'text' | 'shape' | 'image';

/**
 * Left panel tab options for the editor icon rail
 */
export type LeftPanelTab = 'templates' | 'ai' | 'graphics' | 'uploads' | 'slides';

/**
 * Template categories for filtering
 */
export type TemplateCategory = 'professional' | 'creative' | 'minimal' | 'bold' | 'brand';

/**
 * Export format options
 */
export type ExportFormat = 'pdf' | 'png';

/**
 * Base canvas element interface
 */
export interface CanvasElementBase {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
}

/**
 * Text-specific element properties
 */
export interface TextElementProps {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontStyle?: 'normal' | 'italic';
  fill: string;
  align: TextAlign;
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: 'none' | 'underline' | 'line-through';
}

/**
 * Shape-specific element properties
 */
export interface ShapeElementProps {
  shapeType: ShapeType;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

/**
 * Image-specific element properties
 */
export interface ImageElementProps {
  src: string;
  alt?: string;
  /** When true, the element auto-adjusts its width/height to match the image's natural aspect ratio on load */
  preserveAspectRatio?: boolean;
  /** Hex color for icon/image tinting (applied as a color overlay) */
  tintColor?: string;
}

/**
 * Text canvas element
 */
export interface CanvasTextElement extends CanvasElementBase, TextElementProps {
  type: 'text';
}

/**
 * Shape canvas element
 */
export interface CanvasShapeElement extends CanvasElementBase, ShapeElementProps {
  type: 'shape';
}

/**
 * Image canvas element
 */
export interface CanvasImageElement extends CanvasElementBase, ImageElementProps {
  type: 'image';
}

/**
 * Union type for all canvas elements
 */
export type CanvasElement = CanvasTextElement | CanvasShapeElement | CanvasImageElement;

/**
 * Single slide in the carousel
 */
export interface CanvasSlide {
  id: string;
  elements: CanvasElement[];
  backgroundColor: string;
  backgroundImage?: string;
}

/**
 * Canvas template definition
 */
export interface CanvasTemplate {
  id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  thumbnail?: string;
  defaultSlides: CanvasSlide[];
  brandColors: string[];
  fonts: string[];
  /** Whether this template is marked as a default favorite. Defaults to false. */
  isFavorite?: boolean;
  /** Default tone for AI content generation. One of: professional, casual, educational, inspirational, storytelling, match-my-style */
  defaultTone?: string;
}

/**
 * Export options for PDF/PNG generation
 */
export interface ExportOptions {
  format: ExportFormat;
  quality: 'low' | 'medium' | 'high';
  pixelRatio: number;
  fileName?: string;
}

/**
 * Canvas editor state for the main hook
 */
export interface CanvasEditorState {
  slides: CanvasSlide[];
  currentSlideIndex: number;
  selectedElementId: string | null;
  template: CanvasTemplate | null;
  zoom: number;
  showGrid: boolean;
  isExporting: boolean;
}

/**
 * History entry for undo/redo
 */
export interface HistoryEntry {
  slides: CanvasSlide[];
  currentSlideIndex: number;
  selectedElementId: string | null;
}

/**
 * Editor action types for state management
 */
export type CanvasEditorAction =
  | { type: 'SET_SLIDES'; payload: CanvasSlide[] }
  | { type: 'SET_CURRENT_SLIDE'; payload: number }
  | { type: 'SELECT_ELEMENT'; payload: string | null }
  | { type: 'UPDATE_ELEMENT'; payload: { slideIndex: number; elementId: string; updates: Partial<CanvasElement> } }
  | { type: 'ADD_ELEMENT'; payload: { slideIndex: number; element: CanvasElement } }
  | { type: 'DELETE_ELEMENT'; payload: { slideIndex: number; elementId: string } }
  | { type: 'ADD_SLIDE'; payload?: CanvasSlide }
  | { type: 'DELETE_SLIDE'; payload: number }
  | { type: 'DUPLICATE_SLIDE'; payload: number }
  | { type: 'REORDER_SLIDES'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'UPDATE_SLIDE_BACKGROUND'; payload: { slideIndex: number; color: string } }
  | { type: 'APPLY_TEMPLATE'; payload: CanvasTemplate }
  | { type: 'SET_TEMPLATE'; payload: CanvasTemplate }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'TOGGLE_GRID' }
  | { type: 'SET_EXPORTING'; payload: boolean }
  | { type: 'UNDO' }
  | { type: 'REDO' };

/**
 * Props for the main canvas editor component
 */
export interface CanvasEditorProps {
  initialTemplate?: CanvasTemplate;
  onSave?: (slides: CanvasSlide[]) => void;
  onExport?: (blob: Blob) => void;
  className?: string;
}

/**
 * Props for the canvas stage component
 */
export interface CanvasStageProps {
  slide: CanvasSlide;
  selectedElementId: string | null;
  onElementSelect: (id: string | null) => void;
  onElementUpdate: (elementId: string, updates: Partial<CanvasElement>) => void;
  zoom: number;
  showGrid: boolean;
}

/**
 * Props for individual canvas elements
 */
export interface CanvasElementProps<T extends CanvasElement = CanvasElement> {
  element: T;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onChange: (updates: Partial<T>) => void;
}

/**
 * Props for the slide thumbnails component
 */
export interface SlideThumbnailsProps {
  slides: CanvasSlide[];
  currentSlideIndex: number;
  onSlideSelect: (index: number) => void;
  onAddSlide: () => void;
  onDeleteSlide: (index: number) => void;
  onDuplicateSlide: (index: number) => void;
  onReorderSlides: (fromIndex: number, toIndex: number) => void;
}

/**
 * Props for the property panel component
 */
export interface PropertyPanelProps {
  selectedElement: CanvasElement | null;
  currentSlide: CanvasSlide;
  templateColors: string[];
  onElementUpdate: (updates: Partial<CanvasElement>) => void;
  onSlideBackgroundChange: (color: string) => void;
  onAddElement: (type: ElementType) => void;
  onDeleteElement: () => void;
}

/**
 * Props for the template selector modal
 */
export interface TemplateSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: CanvasTemplate) => void;
}

/**
 * Props for the export dialog
 */
export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: ExportOptions) => void;
  isExporting: boolean;
  slideCount: number;
}

/**
 * LinkedIn carousel dimensions (square format)
 */
export const CANVAS_DIMENSIONS = {
  width: 1080,
  height: 1080,
} as const;

/**
 * Maximum number of slides allowed
 */
export const MAX_SLIDES = 10;

/**
 * Default fonts available in the editor
 */
export const DEFAULT_FONTS = [
  'Inter',
  'Playfair Display',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Lato',
  'Poppins',
  'Raleway',
] as const;

/**
 * Default colors palette
 */
export const DEFAULT_COLORS = [
  '#000000', // Black
  '#ffffff', // White
  '#1e3a5f', // Navy
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#6b7280', // Gray
] as const;
