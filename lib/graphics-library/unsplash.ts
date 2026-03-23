/**
 * Unsplash API Client
 * @description Server-side utility for searching free stock photos via the Unsplash API.
 * Used by the graphics library API route to proxy requests.
 * @module lib/graphics-library/unsplash
 */

import type { UnsplashSearchResponse } from '@/types/graphics-library';

/** Base URL for the Unsplash API */
const UNSPLASH_API_URL = 'https://api.unsplash.com';

/**
 * Search for photos on Unsplash
 * @param query - Search query string (e.g. "business meeting")
 * @param page - Page number for pagination (1-indexed)
 * @param perPage - Number of results per page (max 30)
 * @returns Typed search response with image results and pagination info
 * @throws {Error} When UNSPLASH_ACCESS_KEY is not configured
 * @throws {Error} When the API request fails
 * @example
 * const results = await searchUnsplashPhotos('workspace', 1, 20);
 * console.log(results.results[0].urls.regular);
 */
export async function searchUnsplashPhotos(
  query: string,
  page = 1,
  perPage = 20
): Promise<UnsplashSearchResponse> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    throw new Error('UNSPLASH_ACCESS_KEY not configured');
  }

  const params = new URLSearchParams({
    query,
    page: String(page),
    per_page: String(Math.min(perPage, 30)),
    orientation: 'squarish',
  });

  const response = await fetch(
    `${UNSPLASH_API_URL}/search/photos?${params.toString()}`,
    {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        'Accept-Version': 'v1',
      },
      next: { revalidate: 300 },
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(
      `Unsplash API error (${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as UnsplashSearchResponse;
  return data;
}
