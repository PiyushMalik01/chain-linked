/**
 * Shape Collection for the Graphics Library
 * @description Pre-built decorative shapes for LinkedIn carousel slides.
 * Each shape includes a configuration for canvas insertion and an SVG preview.
 * @module lib/graphics-library/shape-collection
 */

import type { ShapeAsset } from '@/types/graphics-library';

/**
 * Complete collection of decorative shapes organized by category.
 * Categories: dividers, badges, frames, arrows, decorative.
 * Each shape has a preview SVG for the panel thumbnail and an element config for insertion.
 */
export const shapeCollection: ShapeAsset[] = [
  // =========================================================================
  // Dividers (~8)
  // =========================================================================
  {
    id: 'shape-thin-line',
    name: 'Thin Line',
    category: 'dividers',
    element: {
      width: 400,
      height: 2,
      shapeType: 'rect',
      fill: '#000000',
      cornerRadius: 1,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 20"><rect x="5" y="9" width="70" height="2" rx="1" fill="#666"/></svg>',
  },
  {
    id: 'shape-thick-line',
    name: 'Thick Line',
    category: 'dividers',
    element: {
      width: 400,
      height: 6,
      shapeType: 'rect',
      fill: '#000000',
      cornerRadius: 3,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 20"><rect x="5" y="7" width="70" height="6" rx="3" fill="#666"/></svg>',
  },
  {
    id: 'shape-accent-line',
    name: 'Accent Line',
    category: 'dividers',
    element: {
      width: 120,
      height: 4,
      shapeType: 'rect',
      fill: '#3b82f6',
      cornerRadius: 2,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 20"><rect x="15" y="8" width="50" height="4" rx="2" fill="#3b82f6"/></svg>',
  },
  {
    id: 'shape-wide-separator',
    name: 'Wide Separator',
    category: 'dividers',
    element: {
      width: 800,
      height: 2,
      shapeType: 'rect',
      fill: '#d1d5db',
      cornerRadius: 1,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 20"><rect x="2" y="9" width="76" height="2" rx="1" fill="#d1d5db"/></svg>',
  },
  {
    id: 'shape-gradient-bar',
    name: 'Gradient Bar',
    category: 'dividers',
    element: {
      width: 600,
      height: 4,
      shapeType: 'rect',
      fill: '#8b5cf6',
      cornerRadius: 2,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 20"><rect x="5" y="8" width="70" height="4" rx="2" fill="#8b5cf6"/></svg>',
  },
  {
    id: 'shape-short-dash',
    name: 'Short Dash',
    category: 'dividers',
    element: {
      width: 80,
      height: 4,
      shapeType: 'rect',
      fill: '#000000',
      cornerRadius: 2,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 20"><rect x="25" y="8" width="30" height="4" rx="2" fill="#666"/></svg>',
  },
  {
    id: 'shape-double-line',
    name: 'Double Line',
    category: 'dividers',
    element: {
      width: 400,
      height: 8,
      shapeType: 'rect',
      fill: '#000000',
      cornerRadius: 0,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 20"><rect x="5" y="7" width="70" height="2" fill="#666"/><rect x="5" y="11" width="70" height="2" fill="#666"/></svg>',
  },
  {
    id: 'shape-dot-divider',
    name: 'Dot Divider',
    category: 'dividers',
    element: {
      width: 8,
      height: 8,
      shapeType: 'circle',
      fill: '#000000',
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 20"><circle cx="25" cy="10" r="3" fill="#666"/><circle cx="40" cy="10" r="3" fill="#666"/><circle cx="55" cy="10" r="3" fill="#666"/></svg>',
  },

  // =========================================================================
  // Badges (~8)
  // =========================================================================
  {
    id: 'shape-pill-badge',
    name: 'Pill Badge',
    category: 'badges',
    element: {
      width: 160,
      height: 40,
      shapeType: 'rect',
      fill: '#3b82f6',
      cornerRadius: 20,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><rect x="10" y="8" width="60" height="24" rx="12" fill="#3b82f6"/></svg>',
  },
  {
    id: 'shape-circle-badge',
    name: 'Circle Badge',
    category: 'badges',
    element: {
      width: 80,
      height: 80,
      shapeType: 'circle',
      fill: '#3b82f6',
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="30" fill="#3b82f6"/></svg>',
  },
  {
    id: 'shape-rounded-square',
    name: 'Rounded Square',
    category: 'badges',
    element: {
      width: 100,
      height: 100,
      shapeType: 'rect',
      fill: '#10b981',
      cornerRadius: 16,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect x="10" y="10" width="60" height="60" rx="16" fill="#10b981"/></svg>',
  },
  {
    id: 'shape-number-circle',
    name: 'Number Circle',
    category: 'badges',
    element: {
      width: 60,
      height: 60,
      shapeType: 'circle',
      fill: '#1e3a5f',
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="25" fill="#1e3a5f"/></svg>',
  },
  {
    id: 'shape-wide-pill',
    name: 'Wide Pill',
    category: 'badges',
    element: {
      width: 240,
      height: 48,
      shapeType: 'rect',
      fill: '#f59e0b',
      cornerRadius: 24,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 30"><rect x="5" y="5" width="70" height="20" rx="10" fill="#f59e0b"/></svg>',
  },
  {
    id: 'shape-tag-badge',
    name: 'Tag Badge',
    category: 'badges',
    element: {
      width: 120,
      height: 36,
      shapeType: 'rect',
      fill: '#ef4444',
      cornerRadius: 6,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 30"><rect x="10" y="3" width="60" height="24" rx="6" fill="#ef4444"/></svg>',
  },
  {
    id: 'shape-outlined-badge',
    name: 'Outlined Badge',
    category: 'badges',
    element: {
      width: 160,
      height: 40,
      shapeType: 'rect',
      fill: 'transparent',
      stroke: '#3b82f6',
      strokeWidth: 2,
      cornerRadius: 20,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><rect x="10" y="8" width="60" height="24" rx="12" fill="none" stroke="#3b82f6" stroke-width="2"/></svg>',
  },
  {
    id: 'shape-circle-outlined',
    name: 'Circle Outlined',
    category: 'badges',
    element: {
      width: 80,
      height: 80,
      shapeType: 'circle',
      fill: 'transparent',
      stroke: '#8b5cf6',
      strokeWidth: 2,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="28" fill="none" stroke="#8b5cf6" stroke-width="2"/></svg>',
  },

  // =========================================================================
  // Frames (~6)
  // =========================================================================
  {
    id: 'shape-square-frame',
    name: 'Square Frame',
    category: 'frames',
    element: {
      width: 300,
      height: 300,
      shapeType: 'rect',
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 3,
      cornerRadius: 0,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect x="10" y="10" width="60" height="60" fill="none" stroke="#666" stroke-width="3"/></svg>',
  },
  {
    id: 'shape-rounded-frame',
    name: 'Rounded Frame',
    category: 'frames',
    element: {
      width: 300,
      height: 300,
      shapeType: 'rect',
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 3,
      cornerRadius: 20,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect x="10" y="10" width="60" height="60" rx="12" fill="none" stroke="#666" stroke-width="3"/></svg>',
  },
  {
    id: 'shape-circle-frame',
    name: 'Circle Frame',
    category: 'frames',
    element: {
      width: 200,
      height: 200,
      shapeType: 'circle',
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 3,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="28" fill="none" stroke="#666" stroke-width="3"/></svg>',
  },
  {
    id: 'shape-thick-frame',
    name: 'Thick Frame',
    category: 'frames',
    element: {
      width: 300,
      height: 300,
      shapeType: 'rect',
      fill: 'transparent',
      stroke: '#1e3a5f',
      strokeWidth: 8,
      cornerRadius: 0,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect x="12" y="12" width="56" height="56" fill="none" stroke="#1e3a5f" stroke-width="6"/></svg>',
  },
  {
    id: 'shape-thin-circle-frame',
    name: 'Thin Circle',
    category: 'frames',
    element: {
      width: 200,
      height: 200,
      shapeType: 'circle',
      fill: 'transparent',
      stroke: '#d1d5db',
      strokeWidth: 1,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="30" fill="none" stroke="#d1d5db" stroke-width="1"/></svg>',
  },
  {
    id: 'shape-portrait-frame',
    name: 'Portrait Frame',
    category: 'frames',
    element: {
      width: 200,
      height: 280,
      shapeType: 'rect',
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 3,
      cornerRadius: 8,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80"><rect x="8" y="5" width="44" height="70" rx="6" fill="none" stroke="#666" stroke-width="3"/></svg>',
  },

  // =========================================================================
  // Arrows (~6)
  // =========================================================================
  {
    id: 'shape-right-arrow',
    name: 'Right Arrow',
    category: 'arrows',
    element: {
      width: 100,
      height: 60,
      shapeType: 'rect',
      fill: '#3b82f6',
      cornerRadius: 4,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><polygon points="10,12 50,12 50,5 70,20 50,35 50,28 10,28" fill="#3b82f6"/></svg>',
  },
  {
    id: 'shape-left-arrow',
    name: 'Left Arrow',
    category: 'arrows',
    element: {
      width: 100,
      height: 60,
      shapeType: 'rect',
      fill: '#3b82f6',
      cornerRadius: 4,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><polygon points="70,12 30,12 30,5 10,20 30,35 30,28 70,28" fill="#3b82f6"/></svg>',
  },
  {
    id: 'shape-up-arrow',
    name: 'Up Arrow',
    category: 'arrows',
    element: {
      width: 60,
      height: 100,
      shapeType: 'rect',
      fill: '#10b981',
      cornerRadius: 4,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 60"><polygon points="20,5 35,25 27,25 27,55 13,55 13,25 5,25" fill="#10b981"/></svg>',
  },
  {
    id: 'shape-down-arrow',
    name: 'Down Arrow',
    category: 'arrows',
    element: {
      width: 60,
      height: 100,
      shapeType: 'rect',
      fill: '#ef4444',
      cornerRadius: 4,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 60"><polygon points="20,55 35,35 27,35 27,5 13,5 13,35 5,35" fill="#ef4444"/></svg>',
  },
  {
    id: 'shape-chevron-right',
    name: 'Chevron Right',
    category: 'arrows',
    element: {
      width: 60,
      height: 80,
      shapeType: 'rect',
      fill: '#8b5cf6',
      cornerRadius: 4,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 60"><polyline points="12,5 28,30 12,55" fill="none" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
  {
    id: 'shape-double-chevron',
    name: 'Double Chevron',
    category: 'arrows',
    element: {
      width: 80,
      height: 80,
      shapeType: 'rect',
      fill: '#f59e0b',
      cornerRadius: 4,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"><polyline points="8,8 22,30 8,52" fill="none" stroke="#f59e0b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><polyline points="28,8 42,30 28,52" fill="none" stroke="#f59e0b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },

  // =========================================================================
  // Decorative (~10)
  // =========================================================================
  {
    id: 'shape-large-circle',
    name: 'Large Circle',
    category: 'decorative',
    element: {
      width: 400,
      height: 400,
      shapeType: 'circle',
      fill: '#3b82f6',
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="35" fill="#3b82f6" opacity="0.8"/></svg>',
  },
  {
    id: 'shape-small-circle',
    name: 'Small Circle',
    category: 'decorative',
    element: {
      width: 40,
      height: 40,
      shapeType: 'circle',
      fill: '#3b82f6',
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="15" fill="#3b82f6"/></svg>',
  },
  {
    id: 'shape-accent-bar',
    name: 'Accent Bar',
    category: 'decorative',
    element: {
      width: 1080,
      height: 8,
      shapeType: 'rect',
      fill: '#3b82f6',
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 20"><rect x="0" y="8" width="80" height="4" fill="#3b82f6"/></svg>',
  },
  {
    id: 'shape-sidebar-block',
    name: 'Sidebar Block',
    category: 'decorative',
    element: {
      width: 12,
      height: 200,
      shapeType: 'rect',
      fill: '#3b82f6',
      cornerRadius: 0,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 80"><rect x="9" y="5" width="8" height="70" fill="#3b82f6"/></svg>',
  },
  {
    id: 'shape-square-block',
    name: 'Square Block',
    category: 'decorative',
    element: {
      width: 300,
      height: 300,
      shapeType: 'rect',
      fill: '#1e3a5f',
      cornerRadius: 0,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect x="10" y="10" width="60" height="60" fill="#1e3a5f"/></svg>',
  },
  {
    id: 'shape-hero-rect',
    name: 'Hero Rectangle',
    category: 'decorative',
    element: {
      width: 900,
      height: 500,
      shapeType: 'rect',
      fill: '#1e3a5f',
      cornerRadius: 16,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 50"><rect x="5" y="5" width="70" height="40" rx="6" fill="#1e3a5f"/></svg>',
  },
  {
    id: 'shape-half-circle',
    name: 'Half Circle',
    category: 'decorative',
    element: {
      width: 300,
      height: 150,
      shapeType: 'circle',
      fill: '#ec4899',
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><path d="M10 40 A30 30 0 0 1 70 40" fill="#ec4899"/></svg>',
  },
  {
    id: 'shape-corner-accent',
    name: 'Corner Accent',
    category: 'decorative',
    element: {
      width: 200,
      height: 200,
      shapeType: 'rect',
      fill: '#3b82f6',
      cornerRadius: 0,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect x="0" y="0" width="40" height="40" fill="#3b82f6" opacity="0.6"/></svg>',
  },
  {
    id: 'shape-overlay-dark',
    name: 'Dark Overlay',
    category: 'decorative',
    element: {
      width: 1080,
      height: 1080,
      shapeType: 'rect',
      fill: '#000000',
      cornerRadius: 0,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect x="5" y="5" width="70" height="70" fill="#000000" opacity="0.5"/></svg>',
  },
  {
    id: 'shape-rounded-card',
    name: 'Rounded Card',
    category: 'decorative',
    element: {
      width: 800,
      height: 400,
      shapeType: 'rect',
      fill: '#ffffff',
      stroke: '#e5e7eb',
      strokeWidth: 2,
      cornerRadius: 24,
    },
    previewSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><rect x="5" y="5" width="70" height="30" rx="8" fill="#ffffff" stroke="#e5e7eb" stroke-width="1.5"/></svg>',
  },
];
