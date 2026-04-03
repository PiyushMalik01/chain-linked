/**
 * Carousel Hook
 * @description Manages carousel state and PDF export functionality
 * @module hooks/use-carousel
 */

'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import type {
  CarouselSlide,
  CarouselBrandKit,
  CarouselTemplateType,
  CarouselFormatType,
} from '@/types/carousel'
import {
  DEFAULT_BRAND_KIT,
  DEFAULT_CAROUSEL_SLIDES,
} from '@/types/carousel'
import {
  exportCarouselToPDF,
  downloadPDF,
} from '@/lib/pdf-export'
import type { CarouselDraftState } from '@/types/draft-state'

/**
 * Props for initializing the carousel hook
 */
export interface UseCarouselProps {
  /** Initial slides to populate the editor with */
  initialSlides?: CarouselSlide[]
  /** Initial brand kit for styling */
  initialBrandKit?: CarouselBrandKit
  /** Initial template selection */
  initialTemplate?: CarouselTemplateType
}

/**
 * Return type for the useCarousel hook
 */
export interface UseCarouselReturn {
  /** Current array of slides */
  slides: CarouselSlide[]
  /** Currently selected template */
  selectedTemplate: CarouselTemplateType
  /** Current index of the slide being previewed */
  currentSlideIndex: number
  /** Current slide being previewed */
  currentSlide: CarouselSlide | undefined
  /** Brand kit configuration */
  brandKit: CarouselBrandKit
  /** Whether brand kit is applied to preview */
  brandKitApplied: boolean
  /** Whether PDF export is in progress */
  isExporting: boolean
  /** Whether save is in progress */
  isSaving: boolean
  /** Add a new slide */
  addSlide: () => void
  /** Remove a slide by ID */
  removeSlide: (slideId: string) => void
  /** Update slide content */
  updateSlideContent: (slideId: string, content: string) => void
  /** Update slide type */
  updateSlideType: (slideId: string, type: CarouselSlide['type']) => void
  /** Reorder slides */
  reorderSlides: (newSlides: CarouselSlide[]) => void
  /** Set the selected template */
  setTemplate: (template: CarouselTemplateType) => void
  /** Navigate to previous slide in preview */
  goToPreviousSlide: () => void
  /** Navigate to next slide in preview */
  goToNextSlide: () => void
  /** Jump to specific slide index */
  goToSlide: (index: number) => void
  /** Toggle brand kit application */
  toggleBrandKit: () => void
  /** Update brand kit values */
  updateBrandKit: (updates: Partial<CarouselBrandKit>) => void
  /** Export carousel to PDF */
  exportToPDF: (format?: CarouselFormatType, filename?: string) => Promise<void>
  /** Save carousel as draft */
  saveDraft: () => Promise<void>
  /** Reset carousel to initial state */
  resetCarousel: () => void
}

/**
 * Generates a unique ID for new slides
 * @returns A unique string ID
 */
function generateSlideId(): string {
  return `slide-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Hook to manage carousel state and PDF export functionality
 *
 * @param props - Optional initial configuration
 * @returns Carousel state and control functions
 *
 * @example
 * ```tsx
 * const {
 *   slides,
 *   addSlide,
 *   exportToPDF,
 *   currentSlide,
 * } = useCarousel({
 *   initialSlides: mySlides,
 *   initialTemplate: 'bold',
 * })
 * ```
 */
export function useCarousel(props: UseCarouselProps = {}): UseCarouselReturn {
  const {
    initialSlides,
    initialBrandKit,
    initialTemplate = 'bold',
  } = props

  // State
  const [slides, setSlides] = useState<CarouselSlide[]>(
    initialSlides ?? DEFAULT_CAROUSEL_SLIDES
  )
  const [selectedTemplate, setSelectedTemplate] = useState<CarouselTemplateType>(initialTemplate)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [brandKit, setBrandKit] = useState<CarouselBrandKit>(
    initialBrandKit ?? DEFAULT_BRAND_KIT
  )
  const [brandKitApplied, setBrandKitApplied] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  /** Tracks the draft row ID so subsequent saves update in place */
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null)

  // Computed
  const currentSlide = slides[currentSlideIndex]

  /**
   * Add a new slide to the carousel
   */
  const addSlide = useCallback(() => {
    const newSlide: CarouselSlide = {
      id: generateSlideId(),
      content: '',
      type: 'content',
    }
    setSlides((prev) => [...prev, newSlide])
    setCurrentSlideIndex(slides.length)
  }, [slides.length])

  /**
   * Remove a slide from the carousel
   */
  const removeSlide = useCallback((slideId: string) => {
    if (slides.length <= 1) {
      toast.error('Cannot remove the last slide')
      return
    }

    const slideIndex = slides.findIndex((s) => s.id === slideId)
    setSlides((prev) => prev.filter((s) => s.id !== slideId))

    // Adjust current slide index if necessary
    if (currentSlideIndex >= slides.length - 1) {
      setCurrentSlideIndex(Math.max(0, slides.length - 2))
    } else if (slideIndex <= currentSlideIndex && currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1)
    }
  }, [slides, currentSlideIndex])

  /**
   * Update a slide's content
   */
  const updateSlideContent = useCallback((slideId: string, content: string) => {
    setSlides((prev) =>
      prev.map((slide) =>
        slide.id === slideId ? { ...slide, content } : slide
      )
    )
  }, [])

  /**
   * Update a slide's type
   */
  const updateSlideType = useCallback((slideId: string, type: CarouselSlide['type']) => {
    setSlides((prev) =>
      prev.map((slide) =>
        slide.id === slideId ? { ...slide, type } : slide
      )
    )
  }, [])

  /**
   * Reorder slides (for drag and drop)
   */
  const reorderSlides = useCallback((newSlides: CarouselSlide[]) => {
    setSlides(newSlides)
  }, [])

  /**
   * Set the selected template
   */
  const setTemplate = useCallback((template: CarouselTemplateType) => {
    setSelectedTemplate(template)
  }, [])

  /**
   * Navigate to previous slide
   */
  const goToPreviousSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => Math.max(0, prev - 1))
  }, [])

  /**
   * Navigate to next slide
   */
  const goToNextSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => Math.min(slides.length - 1, prev + 1))
  }, [slides.length])

  /**
   * Jump to specific slide index
   */
  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < slides.length) {
      setCurrentSlideIndex(index)
    }
  }, [slides.length])

  /**
   * Toggle brand kit application
   */
  const toggleBrandKit = useCallback(() => {
    setBrandKitApplied((prev) => !prev)
  }, [])

  /**
   * Update brand kit values
   */
  const updateBrandKit = useCallback((updates: Partial<CarouselBrandKit>) => {
    setBrandKit((prev) => ({ ...prev, ...updates }))
  }, [])

  /**
   * Export carousel to PDF
   */
  const exportToPDF = useCallback(async (
    format: CarouselFormatType = 'square',
    filename: string = 'carousel.pdf'
  ) => {
    if (slides.length === 0) {
      toast.error('Add at least one slide to export')
      return
    }

    // Check for empty slides
    const emptySlides = slides.filter((s) => !s.content.trim())
    if (emptySlides.length > 0) {
      toast.warning(`${emptySlides.length} slide(s) have no content`)
    }

    setIsExporting(true)
    try {
      // Convert component slides to PDF export format
      const pdfSlides = slides.map((slide, index) => ({
        id: slide.id,
        title: slide.type === 'title' || slide.type === 'cta' ? slide.content : '',
        content: slide.type === 'content' || slide.type === 'stat' ? slide.content : '',
        order: index,
        // Pass original type for template rendering
        slideType: slide.type,
      }))

      const pdfBlob = await exportCarouselToPDF({
        slides: pdfSlides,
        brandKit: brandKitApplied ? brandKit : DEFAULT_BRAND_KIT,
        template: selectedTemplate,
        format,
        filename,
      })

      downloadPDF(pdfBlob, filename)
      toast.success('Carousel exported successfully!')
    } catch (error) {
      console.error('Failed to export carousel:', error)
      toast.error('Failed to export PDF. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }, [slides, brandKit, brandKitApplied, selectedTemplate])

  /**
   * Save carousel as draft via the auto-save API
   * Persists the carousel content to the generated_posts table with source 'carousel'.
   * Falls back to the previous draft ID when updating in place.
   */
  const saveDraft = useCallback(async () => {
    if (slides.length === 0) {
      toast.error('Add at least one slide to save')
      return
    }

    setIsSaving(true)
    try {
      // Build a plain-text representation of the carousel slides for the draft content
      const content = slides
        .map((slide, i) => `[Slide ${i + 1} - ${slide.type}] ${slide.content}`)
        .join('\n\n')

      // Build type-specific draft state for full editor restoration
      const draftState: CarouselDraftState = {
        type: 'carousel' as const,
        slides: slides.map((s) => ({ id: s.id, content: s.content, type: s.type })),
        templateName: selectedTemplate,
        brandKitApplied: brandKitApplied,
        brandColors: brandKit.primaryColor ? [brandKit.primaryColor, brandKit.secondaryColor].filter(Boolean) as string[] : undefined,
        fonts: brandKit.fontFamily ? [brandKit.fontFamily] : undefined,
        currentSlideIndex,
        slideCount: slides.length,
      }

      const response = await fetch('/api/drafts/auto-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          postType: 'carousel',
          source: 'carousel',
          topic: `Carousel: ${selectedTemplate} template, ${slides.length} slides`,
          draftId: savedDraftId ?? undefined,
          draftState,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save draft')
      }

      const data = await response.json()
      if (data.id) {
        setSavedDraftId(data.id)
      }

      toast.success('Draft saved successfully!')
    } catch (error) {
      console.error('Failed to save draft:', error)
      toast.error('Failed to save draft. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }, [slides, selectedTemplate, savedDraftId, brandKitApplied, brandKit, currentSlideIndex])

  /**
   * Reset carousel to initial state
   */
  const resetCarousel = useCallback(() => {
    setSlides(initialSlides ?? DEFAULT_CAROUSEL_SLIDES)
    setSelectedTemplate(initialTemplate)
    setCurrentSlideIndex(0)
    setBrandKit(initialBrandKit ?? DEFAULT_BRAND_KIT)
    setBrandKitApplied(false)
  }, [initialSlides, initialBrandKit, initialTemplate])

  return {
    slides,
    selectedTemplate,
    currentSlideIndex,
    currentSlide,
    brandKit,
    brandKitApplied,
    isExporting,
    isSaving,
    addSlide,
    removeSlide,
    updateSlideContent,
    updateSlideType,
    reorderSlides,
    setTemplate,
    goToPreviousSlide,
    goToNextSlide,
    goToSlide,
    toggleBrandKit,
    updateBrandKit,
    exportToPDF,
    saveDraft,
    resetCarousel,
  }
}
