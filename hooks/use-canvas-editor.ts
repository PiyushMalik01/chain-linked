/**
 * Canvas Editor State Management Hook
 * @description Manages slides, elements, selection, history, and template application
 * for the Canva-style carousel editor
 * @module hooks/use-canvas-editor
 */

import { useReducer, useCallback, useRef, useEffect } from 'react';
import type {
  CanvasSlide,
  CanvasElement,
  CanvasTemplate,
  CanvasEditorState,
  CanvasEditorAction,
  HistoryEntry,
  ElementType,
  CanvasTextElement,
  CanvasShapeElement,
  CanvasImageElement,
  CANVAS_DIMENSIONS,
  MAX_SLIDES,
} from '@/types/canvas-editor';
import { isCarouselDraftState } from '@/types/draft-state';

const STORAGE_KEY = 'chainlinked-carousel-draft';
const TEMPLATE_STORAGE_KEY = 'chainlinked-carousel-template';
const DRAFT_STATE_STORAGE_KEY = 'chainlinked-carousel-draft-state';
const MAX_HISTORY = 50;

/**
 * Serializable property whitelist for canvas elements
 * Strips DOM refs, React fibers, and other non-serializable values
 */
const ELEMENT_KEYS = new Set([
  'id', 'type', 'x', 'y', 'width', 'height', 'rotation',
  'text', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
  'fill', 'align', 'lineHeight', 'letterSpacing', 'textDecoration',
  'stroke', 'strokeWidth', 'opacity', 'cornerRadius',
  'shapeType', 'src', 'alt', 'scaleX', 'scaleY',
]);

/**
 * Deep clone slides safely, stripping non-serializable properties
 * Prevents "Converting circular structure to JSON" errors caused by
 * DOM elements or React fiber refs leaking into state
 */
function safeCloneSlides(slides: CanvasSlide[]): CanvasSlide[] {
  return slides.map((slide) => ({
    id: slide.id,
    backgroundColor: slide.backgroundColor,
    elements: (slide.elements || []).map((el) => {
      const clean: Record<string, unknown> = {};
      for (const key of Object.keys(el)) {
        if (ELEMENT_KEYS.has(key)) {
          clean[key] = el[key as keyof typeof el];
        }
      }
      return clean as unknown as CanvasElement;
    }),
  }));
}

/**
 * Generate a unique ID for elements and slides
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a default empty slide
 */
function createDefaultSlide(): CanvasSlide {
  return {
    id: generateId(),
    elements: [],
    backgroundColor: '#ffffff',
  };
}

/**
 * Create a default text element
 */
function createDefaultTextElement(x = 100, y = 100): CanvasTextElement {
  return {
    id: generateId(),
    type: 'text',
    x,
    y,
    width: 400,
    height: 60,
    rotation: 0,
    text: 'Double-click to edit',
    fontSize: 32,
    fontFamily: 'Inter',
    fontWeight: 'normal',
    fill: '#000000',
    align: 'left',
  };
}

/**
 * Create a default shape element
 */
function createDefaultShapeElement(x = 100, y = 100): CanvasShapeElement {
  return {
    id: generateId(),
    type: 'shape',
    x,
    y,
    width: 200,
    height: 200,
    rotation: 0,
    shapeType: 'rect',
    fill: '#3b82f6',
    stroke: undefined,
    strokeWidth: 0,
    cornerRadius: 0,
  };
}

/**
 * Create a default image element
 * @param src - Image source URL or data URL
 * @param x - X position
 * @param y - Y position
 * @param width - Image width (default 300)
 * @param height - Image height (default 300)
 */
function createDefaultImageElement(
  src: string,
  x = 100,
  y = 100,
  width = 300,
  height = 300
): CanvasImageElement {
  return {
    id: generateId(),
    type: 'image',
    x,
    y,
    width,
    height,
    rotation: 0,
    src,
    alt: 'Uploaded image',
  };
}

/**
 * Initial state for the editor
 */
const initialState: CanvasEditorState = {
  slides: [createDefaultSlide()],
  currentSlideIndex: 0,
  selectedElementId: null,
  template: null,
  zoom: 1,
  showGrid: false,
  isExporting: false,
};

/**
 * Reducer for canvas editor state management
 */
function canvasEditorReducer(
  state: CanvasEditorState,
  action: CanvasEditorAction
): CanvasEditorState {
  switch (action.type) {
    case 'SET_SLIDES':
      return { ...state, slides: action.payload };

    case 'SET_CURRENT_SLIDE':
      return {
        ...state,
        currentSlideIndex: action.payload,
        selectedElementId: null,
      };

    case 'SELECT_ELEMENT':
      return { ...state, selectedElementId: action.payload };

    case 'UPDATE_ELEMENT': {
      const { slideIndex, elementId, updates } = action.payload;
      const newSlides = [...state.slides];
      const slide = { ...newSlides[slideIndex] };
      slide.elements = slide.elements.map((el): CanvasElement =>
        el.id === elementId ? ({ ...el, ...updates } as CanvasElement) : el
      );
      newSlides[slideIndex] = slide;
      return { ...state, slides: newSlides };
    }

    case 'ADD_ELEMENT': {
      const { slideIndex, element } = action.payload;
      const newSlides = [...state.slides];
      const slide = { ...newSlides[slideIndex] };
      slide.elements = [...slide.elements, element];
      newSlides[slideIndex] = slide;
      return { ...state, slides: newSlides, selectedElementId: element.id };
    }

    case 'DELETE_ELEMENT': {
      const { slideIndex, elementId } = action.payload;
      const newSlides = [...state.slides];
      const slide = { ...newSlides[slideIndex] };
      slide.elements = slide.elements.filter((el) => el.id !== elementId);
      newSlides[slideIndex] = slide;
      return {
        ...state,
        slides: newSlides,
        selectedElementId:
          state.selectedElementId === elementId ? null : state.selectedElementId,
      };
    }

    case 'ADD_SLIDE': {
      if (state.slides.length >= 10) return state;
      const newSlide = action.payload || createDefaultSlide();
      const newSlides = [...state.slides, newSlide];
      return {
        ...state,
        slides: newSlides,
        currentSlideIndex: newSlides.length - 1,
        selectedElementId: null,
      };
    }

    case 'DELETE_SLIDE': {
      if (state.slides.length <= 1) return state;
      const newSlides = state.slides.filter((_, i) => i !== action.payload);
      const newIndex = Math.min(state.currentSlideIndex, newSlides.length - 1);
      return {
        ...state,
        slides: newSlides,
        currentSlideIndex: newIndex,
        selectedElementId: null,
      };
    }

    case 'DUPLICATE_SLIDE': {
      if (state.slides.length >= 10) return state;
      const slideToCopy = state.slides[action.payload];
      const duplicatedSlide: CanvasSlide = {
        ...JSON.parse(JSON.stringify(slideToCopy)),
        id: generateId(),
        elements: slideToCopy.elements.map((el) => ({
          ...JSON.parse(JSON.stringify(el)),
          id: generateId(),
        })),
      };
      const newSlides = [
        ...state.slides.slice(0, action.payload + 1),
        duplicatedSlide,
        ...state.slides.slice(action.payload + 1),
      ];
      return {
        ...state,
        slides: newSlides,
        currentSlideIndex: action.payload + 1,
        selectedElementId: null,
      };
    }

    case 'REORDER_SLIDES': {
      const { fromIndex, toIndex } = action.payload;
      const newSlides = [...state.slides];
      const [removed] = newSlides.splice(fromIndex, 1);
      newSlides.splice(toIndex, 0, removed);
      return {
        ...state,
        slides: newSlides,
        currentSlideIndex: toIndex,
      };
    }

    case 'UPDATE_SLIDE_BACKGROUND': {
      const { slideIndex, color } = action.payload;
      const newSlides = [...state.slides];
      newSlides[slideIndex] = { ...newSlides[slideIndex], backgroundColor: color };
      return { ...state, slides: newSlides };
    }

    case 'APPLY_TEMPLATE': {
      const clonedSlides = safeCloneSlides(action.payload.defaultSlides || []);
      return {
        ...state,
        slides: clonedSlides.map((slide) => ({
          ...slide,
          id: generateId(),
          elements: (slide.elements || []).map((el) => ({
            ...el,
            id: generateId(),
          })),
        })),
        template: action.payload,
        currentSlideIndex: 0,
        selectedElementId: null,
      };
    }

    case 'SET_TEMPLATE':
      return { ...state, template: action.payload };

    case 'SET_ZOOM':
      return { ...state, zoom: action.payload };

    case 'TOGGLE_GRID':
      return { ...state, showGrid: !state.showGrid };

    case 'SET_EXPORTING':
      return { ...state, isExporting: action.payload };

    default:
      return state;
  }
}

/**
 * Options for the useCanvasEditor hook
 */
interface UseCanvasEditorOptions {
  /** Optional draft ID to fetch carousel data from the API as a fallback */
  draftId?: string;
}

/**
 * Custom hook for managing canvas editor state
 * @param options - Optional configuration including a draft ID for API fallback
 * @returns Editor state and action methods
 */
export function useCanvasEditor(options?: UseCanvasEditorOptions) {
  const [state, dispatch] = useReducer(canvasEditorReducer, initialState);

  // History for undo/redo
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);

  /**
   * Save current state to history
   */
  const saveToHistory = useCallback(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }

    const entry: HistoryEntry = {
      slides: safeCloneSlides(state.slides),
      currentSlideIndex: state.currentSlideIndex,
      selectedElementId: state.selectedElementId,
    };

    // Remove any future history if we're not at the end
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);

    // Add new entry
    historyRef.current.push(entry);

    // Limit history size
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current++;
    }
  }, [state.slides, state.currentSlideIndex, state.selectedElementId]);

  // Hydration flag: prevent saving until localStorage has been loaded.
  // Without this, the initial render's default empty slide overwrites saved data.
  const hydratedRef = useRef(false);

  // Keep a ref to current slides + template for the unmount save
  const slidesRef = useRef(state.slides);
  slidesRef.current = state.slides;
  const templateRef = useRef(state.template);
  templateRef.current = state.template;

  /**
   * Load from localStorage on mount (slides + template).
   * Must run BEFORE the save effects to prevent the initial empty state
   * from overwriting persisted data.
   * Falls back to fetching from the API if a draftId is provided and
   * localStorage doesn't contain valid slide data.
   */
  useEffect(() => {
    let loadedFromStorage = false;
    /** Number of elements found across all restored slides (for debug logging) */
    let restoredElementCount = 0;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      console.debug('[canvas-hydrate] localStorage raw length:', saved?.length ?? 0);
      if (saved) {
        const slides = JSON.parse(saved) as CanvasSlide[];
        if (Array.isArray(slides) && slides.length > 0) {
          // Validate that at least one slide has elements — a draft with slides
          // but zero elements across every slide is a stale placeholder that
          // should be replaced by the authoritative API data.
          restoredElementCount = slides.reduce(
            (sum, s) => sum + (Array.isArray(s.elements) ? s.elements.length : 0),
            0,
          );
          const sanitized = slides.map((s) => ({
            ...s,
            elements: Array.isArray(s.elements) ? s.elements : [],
          }));
          dispatch({ type: 'SET_SLIDES', payload: sanitized });
          loadedFromStorage = restoredElementCount > 0;
          console.debug(
            '[canvas-hydrate] localStorage slides:', slides.length,
            'elements:', restoredElementCount,
            'accepted:', loadedFromStorage,
          );
        }
      }

      const savedTemplate = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (savedTemplate) {
        const template = JSON.parse(savedTemplate) as CanvasTemplate;
        if (template && template.id) {
          dispatch({ type: 'SET_TEMPLATE', payload: template });
        }
      }

      // Restore full draft state (template, caption, slide index) if available
      const savedDraftState = localStorage.getItem(DRAFT_STATE_STORAGE_KEY);
      if (savedDraftState) {
        try {
          const parsed = JSON.parse(savedDraftState);
          if (isCarouselDraftState(parsed)) {
            // Restore current slide index if valid
            if (typeof parsed.currentSlideIndex === 'number' && parsed.currentSlideIndex >= 0) {
              dispatch({ type: 'SET_CURRENT_SLIDE', payload: parsed.currentSlideIndex });
            }
          }
        } catch {
          // Ignore parse errors for draft state
        }
        // Clean up draft state key after consuming it to avoid stale restores
        localStorage.removeItem(DRAFT_STATE_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to load carousel draft from localStorage', e);
    }

    // Mark as hydrated after loading — now saves are safe
    hydratedRef.current = true;

    // Fetch from the API when a draftId is provided.  This always runs when
    // localStorage was empty or had no real elements (loadedFromStorage=false).
    // It also runs as an async *validation* when localStorage DID load —
    // the API response is the authoritative source.  This guards against
    // stale / wrong carousel data lingering in localStorage.
    if (options?.draftId) {
      console.debug('[canvas-hydrate] fetching draft from API, id:', options.draftId, 'localLoaded:', loadedFromStorage);
      fetch(`/api/drafts/${options.draftId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) {
            console.warn('[canvas-hydrate] API returned no data for draft', options.draftId);
            return;
          }

          /**
           * Helper: apply sanitized slides to editor state + localStorage
           */
          const applySlides = (slides: CanvasSlide[], source: string) => {
            const sanitized = slides.map((s: CanvasSlide) => ({
              ...s,
              elements: Array.isArray(s.elements) ? s.elements : [],
            }));
            const apiElementCount = sanitized.reduce(
              (sum, s) => sum + s.elements.length, 0,
            );
            console.debug(
              `[canvas-hydrate] API (${source}) slides:`, sanitized.length,
              'elements:', apiElementCount,
            );
            // Always apply if localStorage was empty / had no elements,
            // or if the API has richer data than what localStorage provided.
            if (!loadedFromStorage || apiElementCount > restoredElementCount) {
              dispatch({ type: 'SET_SLIDES', payload: sanitized });
              localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
              console.debug(`[canvas-hydrate] applied API data (${source}), overriding localStorage`);
            } else {
              console.debug(`[canvas-hydrate] localStorage data is richer, keeping it`);
            }
          };

          // Prefer structured draft_state if available
          if (data.draft_state && isCarouselDraftState(data.draft_state)) {
            const ds = data.draft_state;
            try {
              const slides = ds.slides as CanvasSlide[];
              if (Array.isArray(slides) && slides.length > 0) {
                applySlides(slides, 'draft_state');
              }
            } catch {
              console.warn('[canvas-hydrate] Failed to parse slides from draft_state');
            }
            // Restore slide index
            if (typeof ds.currentSlideIndex === 'number' && ds.currentSlideIndex >= 0) {
              dispatch({ type: 'SET_CURRENT_SLIDE', payload: ds.currentSlideIndex });
            }
            return;
          }

          // Legacy fallback: use source_snippet
          if (!data.source_snippet) {
            console.warn('[canvas-hydrate] API draft has no draft_state or source_snippet');
            return;
          }
          try {
            const slides = JSON.parse(data.source_snippet) as CanvasSlide[];
            if (Array.isArray(slides) && slides.length > 0) {
              applySlides(slides, 'source_snippet');
            }
          } catch {
            console.warn('[canvas-hydrate] Failed to parse slide data from source_snippet');
          }
        })
        .catch((err) => {
          console.warn('[canvas-hydrate] Failed to fetch draft from API', err);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Auto-save slides to localStorage (debounced to avoid excessive writes).
   * Skipped until hydration is complete to prevent overwriting saved data
   * with the initial default empty slide.
   */
  useEffect(() => {
    if (!hydratedRef.current) return;

    const timeoutId = setTimeout(() => {
      try {
        const cleanSlides = safeCloneSlides(state.slides);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanSlides));
      } catch (e) {
        console.warn('Failed to save carousel draft to localStorage');
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [state.slides]);

  /**
   * Save immediately on unmount so data is never lost when navigating away.
   * The debounced save above may be cancelled by the cleanup, so this ensures
   * the latest slides and template are always persisted.
   */
  useEffect(() => {
    return () => {
      try {
        const cleanSlides = safeCloneSlides(slidesRef.current);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanSlides));
        if (templateRef.current) {
          const safeTemplate = {
            ...templateRef.current,
            defaultSlides: safeCloneSlides(templateRef.current.defaultSlides || []),
          };
          localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(safeTemplate));
        }
      } catch (e) {
        console.warn('Failed to save carousel draft on unmount');
      }
    };
  }, []);

  /**
   * Persist full template to localStorage so session can be fully restored
   * (needed for AI Generate to work after page reload)
   */
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      if (state.template) {
        const safeTemplate = {
          ...state.template,
          defaultSlides: safeCloneSlides(state.template.defaultSlides || []),
        };
        localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(safeTemplate));
      }
    } catch (e) {
      console.warn('Failed to save template info to localStorage');
    }
  }, [state.template]);

  // ============ Slide Actions ============

  /**
   * Replace all slides with new slides
   * @param slides - New slides to set
   */
  const setSlides = useCallback((newSlides: CanvasSlide[]) => {
    saveToHistory();
    dispatch({ type: 'SET_SLIDES', payload: newSlides });
    dispatch({ type: 'SET_CURRENT_SLIDE', payload: 0 });
    dispatch({ type: 'SELECT_ELEMENT', payload: null });
  }, [saveToHistory]);

  const setCurrentSlide = useCallback((index: number) => {
    saveToHistory();
    dispatch({ type: 'SET_CURRENT_SLIDE', payload: index });
  }, [saveToHistory]);

  const addSlide = useCallback((slide?: CanvasSlide) => {
    saveToHistory();
    if (!slide && state.template) {
      // Inherit background and structure from the last template slide
      const lastTemplateSlide = state.template.defaultSlides[state.template.defaultSlides.length - 1];
      const newSlide: CanvasSlide = {
        id: generateId(),
        elements: [],
        backgroundColor: lastTemplateSlide?.backgroundColor || '#ffffff',
      };
      dispatch({ type: 'ADD_SLIDE', payload: newSlide });
    } else {
      dispatch({ type: 'ADD_SLIDE', payload: slide });
    }
  }, [saveToHistory, state.template]);

  const deleteSlide = useCallback((index: number) => {
    saveToHistory();
    dispatch({ type: 'DELETE_SLIDE', payload: index });
  }, [saveToHistory]);

  const duplicateSlide = useCallback((index: number) => {
    saveToHistory();
    dispatch({ type: 'DUPLICATE_SLIDE', payload: index });
  }, [saveToHistory]);

  const reorderSlides = useCallback((fromIndex: number, toIndex: number) => {
    saveToHistory();
    dispatch({ type: 'REORDER_SLIDES', payload: { fromIndex, toIndex } });
  }, [saveToHistory]);

  const updateSlideBackground = useCallback((slideIndex: number, color: string) => {
    saveToHistory();
    dispatch({ type: 'UPDATE_SLIDE_BACKGROUND', payload: { slideIndex, color } });
  }, [saveToHistory]);

  // ============ Element Actions ============

  const selectElement = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_ELEMENT', payload: id });
  }, []);

  const updateElement = useCallback(
    (elementId: string, updates: Partial<CanvasElement>) => {
      saveToHistory();
      dispatch({
        type: 'UPDATE_ELEMENT',
        payload: { slideIndex: state.currentSlideIndex, elementId, updates },
      });
    },
    [state.currentSlideIndex, saveToHistory]
  );

  const addElement = useCallback(
    (type: ElementType) => {
      saveToHistory();
      let element: CanvasElement;
      const centerX = 540 - 200; // Center of 1080px canvas
      const centerY = 540 - 30;

      if (type === 'text') {
        element = createDefaultTextElement(centerX, centerY);
      } else if (type === 'shape') {
        element = createDefaultShapeElement(centerX - 100, centerY - 70);
      } else {
        // For image type, create a placeholder
        element = {
          id: generateId(),
          type: 'image',
          x: centerX - 100,
          y: centerY - 100,
          width: 400,
          height: 400,
          rotation: 0,
          src: '',
          alt: 'Image',
        };
      }

      dispatch({
        type: 'ADD_ELEMENT',
        payload: { slideIndex: state.currentSlideIndex, element },
      });
    },
    [state.currentSlideIndex, saveToHistory]
  );

  const deleteElement = useCallback(
    (elementId?: string) => {
      const idToDelete = elementId || state.selectedElementId;
      if (!idToDelete) return;

      saveToHistory();
      dispatch({
        type: 'DELETE_ELEMENT',
        payload: { slideIndex: state.currentSlideIndex, elementId: idToDelete },
      });
    },
    [state.currentSlideIndex, state.selectedElementId, saveToHistory]
  );

  /**
   * Add an image element to the current slide
   * @param src - Image source URL or data URL
   * @param width - Optional image width (auto-calculated if not provided)
   * @param height - Optional image height (auto-calculated if not provided)
   */
  const addImageElement = useCallback(
    (src: string, width?: number, height?: number) => {
      saveToHistory();
      const centerX = 540 - (width ? width / 2 : 150);
      const centerY = 540 - (height ? height / 2 : 150);

      const element = createDefaultImageElement(
        src,
        centerX,
        centerY,
        width || 300,
        height || 300
      );

      dispatch({
        type: 'ADD_ELEMENT',
        payload: { slideIndex: state.currentSlideIndex, element },
      });
    },
    [state.currentSlideIndex, saveToHistory]
  );

  // ============ Template Actions ============

  const applyTemplate = useCallback((template: CanvasTemplate) => {
    saveToHistory();
    dispatch({ type: 'APPLY_TEMPLATE', payload: template });
  }, [saveToHistory]);

  // ============ View Actions ============

  const setZoom = useCallback((zoom: number) => {
    dispatch({ type: 'SET_ZOOM', payload: Math.max(0.25, Math.min(2, zoom)) });
  }, []);

  const toggleGrid = useCallback(() => {
    dispatch({ type: 'TOGGLE_GRID' });
  }, []);

  const setExporting = useCallback((isExporting: boolean) => {
    dispatch({ type: 'SET_EXPORTING', payload: isExporting });
  }, []);

  // ============ History Actions ============

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      isUndoRedoRef.current = true;
      const entry = historyRef.current[historyIndexRef.current];
      dispatch({ type: 'SET_SLIDES', payload: entry.slides });
      dispatch({ type: 'SET_CURRENT_SLIDE', payload: entry.currentSlideIndex });
      dispatch({ type: 'SELECT_ELEMENT', payload: entry.selectedElementId });
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      isUndoRedoRef.current = true;
      const entry = historyRef.current[historyIndexRef.current];
      dispatch({ type: 'SET_SLIDES', payload: entry.slides });
      dispatch({ type: 'SET_CURRENT_SLIDE', payload: entry.currentSlideIndex });
      dispatch({ type: 'SELECT_ELEMENT', payload: entry.selectedElementId });
    }
  }, []);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  // ============ Utility Actions ============

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TEMPLATE_STORAGE_KEY);
      localStorage.removeItem(DRAFT_STATE_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear carousel draft');
    }
  }, []);

  const resetEditor = useCallback(() => {
    saveToHistory();
    dispatch({ type: 'SET_SLIDES', payload: [createDefaultSlide()] });
    dispatch({ type: 'SET_CURRENT_SLIDE', payload: 0 });
    clearDraft();
  }, [saveToHistory, clearDraft]);

  // Get current slide
  const currentSlide = state.slides[state.currentSlideIndex];

  // Get selected element
  const selectedElement = currentSlide?.elements?.find(
    (el) => el.id === state.selectedElementId
  ) || null;

  return {
    // State
    slides: state.slides,
    currentSlideIndex: state.currentSlideIndex,
    currentSlide,
    selectedElementId: state.selectedElementId,
    selectedElement,
    template: state.template,
    zoom: state.zoom,
    showGrid: state.showGrid,
    isExporting: state.isExporting,

    // Slide actions
    setSlides,
    setCurrentSlide,
    addSlide,
    deleteSlide,
    duplicateSlide,
    reorderSlides,
    updateSlideBackground,

    // Element actions
    selectElement,
    updateElement,
    addElement,
    addImageElement,
    deleteElement,

    // Template actions
    applyTemplate,

    // View actions
    setZoom,
    toggleGrid,
    setExporting,

    // History actions
    undo,
    redo,
    canUndo,
    canRedo,

    // Utility actions
    clearDraft,
    resetEditor,
  };
}

export type UseCanvasEditorReturn = ReturnType<typeof useCanvasEditor>;
