/**
 * Graphics Library Hook
 * @description Provides state management and search functionality for the graphics library panel.
 * Handles photo search via API, and client-side filtering for icons and shapes.
 * @module hooks/use-graphics-library
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { iconCollection } from '@/lib/graphics-library/icon-collection';
import { shapeCollection } from '@/lib/graphics-library/shape-collection';
import type {
  UnsplashImage,
  UnsplashSearchResponse,
  IconAsset,
  ShapeAsset,
  IconCategory,
  ShapeCategory,
} from '@/types/graphics-library';

/**
 * Return type for the useGraphicsLibrary hook
 */
interface UseGraphicsLibraryReturn {
  /** Current photo search results */
  photos: UnsplashImage[];
  /** Whether a photo search is in progress */
  isLoadingPhotos: boolean;
  /** Total pages available for pagination */
  totalPages: number;
  /** Error message if the API request failed or is unconfigured */
  photosError: string | null;
  /** Trigger a photo search against the API route */
  searchPhotos: (query: string, page?: number) => Promise<void>;
  /** Filtered icon collection based on search/category */
  icons: IconAsset[];
  /** Search and filter icons by query string */
  searchIcons: (query: string) => void;
  /** Filter icons by category */
  filterIconsByCategory: (category: IconCategory | null) => void;
  /** Currently active icon search query */
  iconQuery: string;
  /** Currently active icon category filter */
  iconCategory: IconCategory | null;
  /** Filtered shape collection based on search/category */
  shapes: ShapeAsset[];
  /** Search and filter shapes by query string */
  searchShapes: (query: string) => void;
  /** Filter shapes by category */
  filterShapesByCategory: (category: ShapeCategory | null) => void;
  /** Currently active shape search query */
  shapeQuery: string;
  /** Currently active shape category filter */
  shapeCategory: ShapeCategory | null;
}

/**
 * Hook for managing graphics library data (photos, icons, shapes).
 * Photos are fetched from the server-side Unsplash API proxy.
 * Icons and shapes are filtered client-side from curated collections.
 *
 * @returns State and methods for searching and filtering graphics assets
 * @example
 * const { photos, searchPhotos, icons, shapes } = useGraphicsLibrary();
 * await searchPhotos('workspace');
 */
export function useGraphicsLibrary(): UseGraphicsLibraryReturn {
  // ====== Photo state ======
  const [photos, setPhotos] = useState<UnsplashImage[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ====== Icon state ======
  const [iconQuery, setIconQuery] = useState('');
  const [iconCategory, setIconCategory] = useState<IconCategory | null>(null);

  // ====== Shape state ======
  const [shapeQuery, setShapeQuery] = useState('');
  const [shapeCategory, setShapeCategory] = useState<ShapeCategory | null>(null);

  // ====== Photo search ======

  /**
   * Search for photos via the Unsplash API proxy
   * @param query - Search query (e.g. "business meeting")
   * @param page - Page number for pagination (default 1)
   */
  const searchPhotos = useCallback(async (query: string, page = 1) => {
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoadingPhotos(true);
    setPhotosError(null);

    try {
      const params = new URLSearchParams({
        q: query,
        page: String(page),
        per_page: '20',
      });

      const response = await fetch(`/api/graphics-library?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }

      const data = (await response.json()) as UnsplashSearchResponse & {
        error?: string;
      };

      if (data.error) {
        setPhotosError(data.error);
      }

      // Append results on pagination, replace on new search
      if (page === 1) {
        setPhotos(data.results);
      } else {
        setPhotos((prev) => [...prev, ...data.results]);
      }
      setTotalPages(data.total_pages);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Request was aborted, ignore
        return;
      }
      console.error('Photo search error:', error);
      setPhotosError('Failed to search photos. Please try again.');
    } finally {
      setIsLoadingPhotos(false);
    }
  }, []);

  // ====== Icon filtering ======

  /**
   * Set the search query for icons (filters by name and tags)
   * @param query - Search text to match against icon names and tags
   */
  const searchIcons = useCallback((query: string) => {
    setIconQuery(query);
  }, []);

  /**
   * Filter icons by a specific category
   * @param category - Category to filter by, or null for all
   */
  const filterIconsByCategory = useCallback((category: IconCategory | null) => {
    setIconCategory(category);
  }, []);

  /** Filtered icons based on current query and category */
  const icons = useMemo(() => {
    let filtered = iconCollection;

    if (iconCategory) {
      filtered = filtered.filter((icon) => icon.category === iconCategory);
    }

    if (iconQuery.trim()) {
      const lowerQuery = iconQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (icon) =>
          icon.name.toLowerCase().includes(lowerQuery) ||
          icon.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
      );
    }

    return filtered;
  }, [iconQuery, iconCategory]);

  // ====== Shape filtering ======

  /**
   * Set the search query for shapes (filters by name)
   * @param query - Search text to match against shape names
   */
  const searchShapes = useCallback((query: string) => {
    setShapeQuery(query);
  }, []);

  /**
   * Filter shapes by a specific category
   * @param category - Category to filter by, or null for all
   */
  const filterShapesByCategory = useCallback(
    (category: ShapeCategory | null) => {
      setShapeCategory(category);
    },
    []
  );

  /** Filtered shapes based on current query and category */
  const shapes = useMemo(() => {
    let filtered = shapeCollection;

    if (shapeCategory) {
      filtered = filtered.filter((shape) => shape.category === shapeCategory);
    }

    if (shapeQuery.trim()) {
      const lowerQuery = shapeQuery.toLowerCase().trim();
      filtered = filtered.filter((shape) =>
        shape.name.toLowerCase().includes(lowerQuery)
      );
    }

    return filtered;
  }, [shapeQuery, shapeCategory]);

  // Cleanup: abort pending photo search on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    photos,
    isLoadingPhotos,
    totalPages,
    photosError,
    searchPhotos,
    icons,
    searchIcons,
    filterIconsByCategory,
    iconQuery,
    iconCategory,
    shapes,
    searchShapes,
    filterShapesByCategory,
    shapeQuery,
    shapeCategory,
  };
}
