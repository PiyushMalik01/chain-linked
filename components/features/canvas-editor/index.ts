/**
 * Canvas Editor Components
 * @description Public barrel exports for the Canva-style carousel editor,
 * including the main editor, stage, element renderers, panels, and dialogs.
 * @module components/features/canvas-editor
 */

export { CanvasEditor } from './canvas-editor';
export { CanvasStage } from './canvas-stage';
export { CanvasTextElement } from './canvas-text-element';
export { CanvasShapeElement } from './canvas-shape-element';
export { CanvasImageElement } from './canvas-image-element';
export { PropertyPanel } from './property-panel';
export { TemplateSelectorModal } from './template-selector-modal';
export { ExportDialog } from './export-dialog';
export { AiContentGenerator } from './ai-content-generator';
export { SaveTemplateDialog } from './save-template-dialog';

// New Canva-style layout components
export { EditorLeftPanel } from './editor-left-panel';
export { EditorIconRail } from './editor-icon-rail';
export { EditorFloatingToolbar } from './editor-floating-toolbar';
export { EditorTopActions } from './editor-top-actions';
export { EnhancedColorPicker } from './enhanced-color-picker';

// Left panel content panels
export { PanelTemplates } from './panel-templates';
export { PanelAiGenerate } from './panel-ai-generate';
export { PanelGraphics } from './panel-graphics';
export { PanelUploads } from './panel-uploads';
export { PanelSlides } from './panel-slides';

// Re-export types
export type { CanvasStageRef } from './canvas-stage';
