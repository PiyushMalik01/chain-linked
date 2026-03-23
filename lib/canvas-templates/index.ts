/**
 * Canvas Templates Registry
 * @description Central export for all carousel templates and template utilities
 * @module lib/canvas-templates
 */

import { professionalTemplate } from './professional-template';
import { creativeTemplate } from './creative-template';
import { minimalTemplate } from './minimal-template';
import { storyTemplate } from './story-template';
import { financialTipsTemplate } from './financial-tips-template';
import { whiteMinimalTimeManagementTemplate } from './white-minimal-time-management-template';
import { creamOrangeEntrepreneurshipTemplate } from './cream-orange-entrepreneurship-template';
import {
  minimalistTemplate,
  boldImpactTemplate,
  corporateProfessionalTemplate,
  creativeGradientTemplate,
  dataStorytellingTemplate,
  storyArcTemplate,
} from './default-templates';
import type { CanvasTemplate, TemplateCategory } from '@/types/canvas-editor';

/**
 * All available templates
 */
export const canvasTemplates: CanvasTemplate[] = [
  professionalTemplate,
  creativeTemplate,
  minimalTemplate,
  storyTemplate,
  financialTipsTemplate,
  whiteMinimalTimeManagementTemplate,
  creamOrangeEntrepreneurshipTemplate,
  minimalistTemplate,
  boldImpactTemplate,
  corporateProfessionalTemplate,
  creativeGradientTemplate,
  dataStorytellingTemplate,
  storyArcTemplate,
];

/**
 * Get templates filtered by category
 * @param category - Template category to filter by
 * @returns Filtered array of templates
 */
export function getTemplatesByCategory(category: TemplateCategory): CanvasTemplate[] {
  return canvasTemplates.filter((template) => template.category === category);
}

/**
 * Get a template by its ID
 * @param id - Template ID
 * @returns Template or undefined if not found
 */
export function getTemplateById(id: string): CanvasTemplate | undefined {
  return canvasTemplates.find((template) => template.id === id);
}

/**
 * Get all unique categories
 * @returns Array of unique category names
 */
export function getTemplateCategories(): TemplateCategory[] {
  const categories = new Set(canvasTemplates.map((t) => t.category));
  return Array.from(categories);
}

// Re-export brand kit template generator
export { generateBrandKitTemplates } from './brand-kit-template-generator';

// Re-export individual templates
export { professionalTemplate } from './professional-template';
export { creativeTemplate } from './creative-template';
export { minimalTemplate } from './minimal-template';
export { storyTemplate } from './story-template';
export { financialTipsTemplate } from './financial-tips-template';
export { whiteMinimalTimeManagementTemplate } from './white-minimal-time-management-template';
export { creamOrangeEntrepreneurshipTemplate } from './cream-orange-entrepreneurship-template';
export {
  minimalistTemplate,
  boldImpactTemplate,
  corporateProfessionalTemplate,
  creativeGradientTemplate,
  dataStorytellingTemplate,
  storyArcTemplate,
} from './default-templates';
