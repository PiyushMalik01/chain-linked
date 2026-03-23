/**
 * Graphics Library Type Definitions
 * @description Types for the graphics/image library panel used in the canvas carousel editor.
 * Covers photo search (Unsplash), curated icons, and decorative shapes.
 * @module types/graphics-library
 */

/**
 * Category options for filtering photo search results
 */
export type PhotoCategory =
  | 'business'
  | 'technology'
  | 'nature'
  | 'people'
  | 'abstract'
  | 'workspace';

/**
 * Active tab in the graphics library panel
 */
export type GraphicsTab = 'photos' | 'icons' | 'shapes';

/**
 * An image result returned from the Unsplash API
 */
export interface UnsplashImage {
  /** Unique image identifier */
  id: string;
  /** Available image URLs at various sizes */
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  /** Accessible description of the image */
  alt_description: string | null;
  /** Photographer information */
  user: {
    name: string;
    links: { html: string };
  };
  /** Original image width in pixels */
  width: number;
  /** Original image height in pixels */
  height: number;
}

/**
 * A curated icon asset with inline SVG data
 */
export interface IconAsset {
  /** Unique icon identifier */
  id: string;
  /** Human-readable icon name */
  name: string;
  /** Icon category for filtering */
  category: IconCategory;
  /** Base64/URI-encoded SVG data URL */
  svgDataUrl: string;
  /** Searchable tags for the icon */
  tags: string[];
}

/**
 * Categories for grouping icons in the library
 */
export type IconCategory =
  | 'business'
  | 'social'
  | 'arrows'
  | 'communication'
  | 'charts'
  | 'general';

/**
 * A pre-built decorative shape template
 */
export interface ShapeAsset {
  /** Unique shape identifier */
  id: string;
  /** Human-readable shape name */
  name: string;
  /** Shape category for filtering */
  category: ShapeCategory;
  /** Configuration used to insert the shape as a canvas element */
  element: ShapeElementConfig;
  /** Inline SVG markup for thumbnail preview */
  previewSvg: string;
}

/**
 * Categories for grouping shapes in the library
 */
export type ShapeCategory =
  | 'dividers'
  | 'badges'
  | 'frames'
  | 'arrows'
  | 'decorative';

/**
 * Configuration object describing a shape element to insert into the canvas
 */
export interface ShapeElementConfig {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** The primitive shape type */
  shapeType: 'rect' | 'circle' | 'line';
  /** Fill color (hex or 'transparent') */
  fill: string;
  /** Optional stroke color */
  stroke?: string;
  /** Optional stroke width in pixels */
  strokeWidth?: number;
  /** Optional corner radius for rounded rectangles */
  cornerRadius?: number;
  /** Optional rotation in degrees */
  rotation?: number;
}

/**
 * Response shape from the Unsplash search photos endpoint
 */
export interface UnsplashSearchResponse {
  /** Array of matching images */
  results: UnsplashImage[];
  /** Total number of matching images */
  total: number;
  /** Total number of pages available */
  total_pages: number;
}
