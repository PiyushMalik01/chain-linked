/**
 * Image Proxy API Route
 * @description Proxies external images to bypass CORS restrictions for canvas rendering
 * @module app/api/proxy-image/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Allowed image content types */
const ALLOWED_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
]

/** Maximum image size: 10MB */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

/** Allowed hostnames for image proxying */
const ALLOWED_HOSTNAMES = [
  'media.licdn.com',
  'img.logo.dev',
  'images.unsplash.com',
  'cdn.brandfetch.io',
]

/**
 * Checks if a hostname matches the allowlist (supports wildcard subdomains for linkedin.com)
 * @param hostname - The hostname to check
 * @returns True if the hostname is allowed
 */
function isAllowedHostname(hostname: string): boolean {
  if (ALLOWED_HOSTNAMES.includes(hostname)) return true
  // Allow *.linkedin.com subdomains
  if (hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')) return true
  return false
}

/**
 * Checks if a hostname resolves to a private/internal IP range
 * @param hostname - The hostname to check
 * @returns True if the hostname appears to be a private/internal address
 */
function isPrivateHost(hostname: string): boolean {
  // Block localhost variants
  if (hostname === 'localhost' || hostname === '::1') return true

  // Check if it's an IP address and block private ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number)
    // 10.0.0.0/8
    if (a === 10) return true
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true
  }

  return false
}

/**
 * GET /api/proxy-image?url=<encoded-url>
 * Fetches an external image and serves it with proper CORS headers
 * @param request - Next.js request with url query parameter
 * @returns Proxied image response with CORS headers
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const url = request.nextUrl.searchParams.get('url')

    if (!url) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      )
    }

    // Validate URL format
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      )
    }

    // Only allow http(s) protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: 'Only HTTP(S) URLs are allowed' },
        { status: 400 }
      )
    }

    // Block private/internal IP addresses (SSRF protection)
    if (isPrivateHost(parsedUrl.hostname)) {
      return NextResponse.json(
        { error: 'Requests to private/internal addresses are not allowed' },
        { status: 403 }
      )
    }

    // Only allow known image hostnames
    if (!isAllowedHostname(parsedUrl.hostname)) {
      return NextResponse.json(
        { error: 'Hostname not allowed' },
        { status: 403 }
      )
    }

    // Fetch the image — LinkedIn CDN requires proper browser-like headers
    const imageResponse = await fetch(url, {
      headers: {
        'Accept': 'image/webp,image/avif,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': 'https://www.linkedin.com/',
        'Origin': 'https://www.linkedin.com',
        'Accept-Language': 'en-US,en;q=0.9',
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'cross-site',
      },
      redirect: 'follow',
    })

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${imageResponse.status}` },
        { status: imageResponse.status }
      )
    }

    // Validate content type
    const contentType = imageResponse.headers.get('content-type') || ''
    const isImage = ALLOWED_CONTENT_TYPES.some(type => contentType.startsWith(type))
    if (!isImage) {
      return NextResponse.json(
        { error: 'URL does not point to a valid image' },
        { status: 400 }
      )
    }

    // Validate content length if available
    const contentLength = imageResponse.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: 'Image too large (max 10MB)' },
        { status: 413 }
      )
    }

    const imageBuffer = await imageResponse.arrayBuffer()

    // Double check size after download
    if (imageBuffer.byteLength > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: 'Image too large (max 10MB)' },
        { status: 413 }
      )
    }

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('[API] Image proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to proxy image' },
      { status: 500 }
    )
  }
}
