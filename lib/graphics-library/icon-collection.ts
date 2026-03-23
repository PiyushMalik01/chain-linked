/**
 * Icon Collection for the Graphics Library
 * @description A curated set of professional SVG icons optimized for LinkedIn carousel slides.
 * Each icon is a 24x24 stroke-based SVG encoded as a data URL.
 * @module lib/graphics-library/icon-collection
 */

import type { IconAsset } from '@/types/graphics-library';

/**
 * Convert a raw SVG string into a data URL suitable for use in <img> tags
 * @param svg - Raw SVG markup string
 * @returns Encoded data URL string
 */
function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Wrap an SVG path/content in a consistent 24x24 viewBox container
 * @param inner - SVG child elements (paths, lines, circles, etc.)
 * @returns Complete SVG string
 */
function icon(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

/**
 * Complete curated collection of icons for the graphics library.
 * Organized by category: business, social, arrows, communication, charts, general.
 * Each icon uses a clean stroke-based style at 24x24 pixels.
 */
export const iconCollection: IconAsset[] = [
  // =========================================================================
  // Business Icons (~15)
  // =========================================================================
  {
    id: 'icon-briefcase',
    name: 'Briefcase',
    category: 'business',
    svgDataUrl: svgToDataUrl(icon('<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>')),
    tags: ['work', 'job', 'career', 'portfolio'],
  },
  {
    id: 'icon-chart-bar',
    name: 'Chart Bar',
    category: 'business',
    svgDataUrl: svgToDataUrl(icon('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>')),
    tags: ['analytics', 'data', 'statistics', 'graph'],
  },
  {
    id: 'icon-trending-up',
    name: 'Trending Up',
    category: 'business',
    svgDataUrl: svgToDataUrl(icon('<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>')),
    tags: ['growth', 'increase', 'profit', 'up'],
  },
  {
    id: 'icon-target',
    name: 'Target',
    category: 'business',
    svgDataUrl: svgToDataUrl(icon('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>')),
    tags: ['goal', 'focus', 'aim', 'objective'],
  },
  {
    id: 'icon-award',
    name: 'Award',
    category: 'business',
    svgDataUrl: svgToDataUrl(icon('<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>')),
    tags: ['trophy', 'medal', 'achievement', 'prize'],
  },
  {
    id: 'icon-bulb',
    name: 'Light Bulb',
    category: 'business',
    svgDataUrl: svgToDataUrl(icon('<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>')),
    tags: ['idea', 'innovation', 'creative', 'inspiration'],
  },
  {
    id: 'icon-rocket',
    name: 'Rocket',
    category: 'business',
    svgDataUrl: svgToDataUrl(icon('<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>')),
    tags: ['launch', 'startup', 'fast', 'growth'],
  },
  {
    id: 'icon-users',
    name: 'Team',
    category: 'business',
    svgDataUrl: svgToDataUrl(icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>')),
    tags: ['group', 'people', 'team', 'collaboration'],
  },
  {
    id: 'icon-handshake',
    name: 'Handshake',
    category: 'business',
    svgDataUrl: svgToDataUrl(icon('<path d="M11 17l-1-1"/><path d="M14 14l-4 4"/><path d="M2 9l5-5 4 4"/><path d="M7 4l5 5"/><path d="M22 9l-5-5-4 4"/><path d="M17 4l-5 5"/><path d="M2 9h5"/><path d="M17 9h5"/><path d="M12 20l2-2"/>')),
    tags: ['deal', 'partnership', 'agreement', 'collaboration'],
  },
  {
    id: 'icon-calendar',
    name: 'Calendar',
    category: 'business',
    svgDataUrl: svgToDataUrl(icon('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>')),
    tags: ['date', 'schedule', 'event', 'planner'],
  },
  {
    id: 'icon-clock',
    name: 'Clock',
    category: 'business',
    svgDataUrl: svgToDataUrl(icon('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>')),
    tags: ['time', 'watch', 'deadline', 'hours'],
  },
  {
    id: 'icon-money',
    name: 'Money',
    category: 'business',
    svgDataUrl: svgToDataUrl(icon('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')),
    tags: ['dollar', 'currency', 'finance', 'payment'],
  },
  {
    id: 'icon-growth',
    name: 'Growth',
    category: 'business',
    svgDataUrl: svgToDataUrl(icon('<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>')),
    tags: ['progress', 'increase', 'chart', 'performance'],
  },
  {
    id: 'icon-presentation',
    name: 'Presentation',
    category: 'business',
    svgDataUrl: svgToDataUrl(icon('<path d="M2 3h20"/><rect x="4" y="3" width="16" height="12" rx="1"/><path d="M12 15v4"/><path d="M8 19h8"/>')),
    tags: ['slides', 'deck', 'meeting', 'screen'],
  },
  {
    id: 'icon-strategy',
    name: 'Strategy',
    category: 'business',
    svgDataUrl: svgToDataUrl(icon('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>')),
    tags: ['layers', 'plan', 'stack', 'structure'],
  },

  // =========================================================================
  // Social Icons (~12)
  // =========================================================================
  {
    id: 'icon-linkedin',
    name: 'LinkedIn',
    category: 'social',
    svgDataUrl: svgToDataUrl(icon('<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>')),
    tags: ['social', 'network', 'professional', 'job'],
  },
  {
    id: 'icon-share',
    name: 'Share',
    category: 'social',
    svgDataUrl: svgToDataUrl(icon('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>')),
    tags: ['repost', 'distribute', 'send', 'forward'],
  },
  {
    id: 'icon-heart',
    name: 'Heart',
    category: 'social',
    svgDataUrl: svgToDataUrl(icon('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>')),
    tags: ['like', 'love', 'favorite', 'appreciate'],
  },
  {
    id: 'icon-comment',
    name: 'Comment',
    category: 'social',
    svgDataUrl: svgToDataUrl(icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>')),
    tags: ['chat', 'reply', 'discuss', 'feedback'],
  },
  {
    id: 'icon-bookmark',
    name: 'Bookmark',
    category: 'social',
    svgDataUrl: svgToDataUrl(icon('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>')),
    tags: ['save', 'pin', 'collection', 'mark'],
  },
  {
    id: 'icon-thumbs-up',
    name: 'Thumbs Up',
    category: 'social',
    svgDataUrl: svgToDataUrl(icon('<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>')),
    tags: ['like', 'approve', 'agree', 'positive'],
  },
  {
    id: 'icon-star',
    name: 'Star',
    category: 'social',
    svgDataUrl: svgToDataUrl(icon('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>')),
    tags: ['rating', 'favorite', 'review', 'quality'],
  },
  {
    id: 'icon-bell',
    name: 'Bell',
    category: 'social',
    svgDataUrl: svgToDataUrl(icon('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>')),
    tags: ['notification', 'alert', 'reminder', 'alarm'],
  },
  {
    id: 'icon-message',
    name: 'Message',
    category: 'social',
    svgDataUrl: svgToDataUrl(icon('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>')),
    tags: ['email', 'inbox', 'letter', 'mail'],
  },
  {
    id: 'icon-at-sign',
    name: 'At Sign',
    category: 'social',
    svgDataUrl: svgToDataUrl(icon('<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>')),
    tags: ['mention', 'email', 'tag', 'handle'],
  },
  {
    id: 'icon-globe',
    name: 'Globe',
    category: 'social',
    svgDataUrl: svgToDataUrl(icon('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>')),
    tags: ['world', 'internet', 'web', 'international'],
  },
  {
    id: 'icon-link',
    name: 'Link',
    category: 'social',
    svgDataUrl: svgToDataUrl(icon('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>')),
    tags: ['url', 'hyperlink', 'chain', 'connect'],
  },

  // =========================================================================
  // Arrow Icons (~12)
  // =========================================================================
  {
    id: 'icon-arrow-right',
    name: 'Arrow Right',
    category: 'arrows',
    svgDataUrl: svgToDataUrl(icon('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>')),
    tags: ['next', 'forward', 'direction', 'right'],
  },
  {
    id: 'icon-arrow-left',
    name: 'Arrow Left',
    category: 'arrows',
    svgDataUrl: svgToDataUrl(icon('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>')),
    tags: ['back', 'previous', 'direction', 'left'],
  },
  {
    id: 'icon-arrow-up',
    name: 'Arrow Up',
    category: 'arrows',
    svgDataUrl: svgToDataUrl(icon('<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>')),
    tags: ['up', 'rise', 'direction', 'top'],
  },
  {
    id: 'icon-arrow-down',
    name: 'Arrow Down',
    category: 'arrows',
    svgDataUrl: svgToDataUrl(icon('<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>')),
    tags: ['down', 'decrease', 'direction', 'bottom'],
  },
  {
    id: 'icon-chevron-right',
    name: 'Chevron Right',
    category: 'arrows',
    svgDataUrl: svgToDataUrl(icon('<polyline points="9 18 15 12 9 6"/>')),
    tags: ['next', 'expand', 'caret', 'forward'],
  },
  {
    id: 'icon-chevron-left',
    name: 'Chevron Left',
    category: 'arrows',
    svgDataUrl: svgToDataUrl(icon('<polyline points="15 18 9 12 15 6"/>')),
    tags: ['back', 'collapse', 'caret', 'previous'],
  },
  {
    id: 'icon-chevron-up',
    name: 'Chevron Up',
    category: 'arrows',
    svgDataUrl: svgToDataUrl(icon('<polyline points="18 15 12 9 6 15"/>')),
    tags: ['up', 'collapse', 'caret', 'top'],
  },
  {
    id: 'icon-chevron-down',
    name: 'Chevron Down',
    category: 'arrows',
    svgDataUrl: svgToDataUrl(icon('<polyline points="6 9 12 15 18 9"/>')),
    tags: ['down', 'expand', 'caret', 'bottom'],
  },
  {
    id: 'icon-arrow-up-right',
    name: 'Arrow Up Right',
    category: 'arrows',
    svgDataUrl: svgToDataUrl(icon('<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>')),
    tags: ['diagonal', 'external', 'growth', 'northeast'],
  },
  {
    id: 'icon-arrow-down-right',
    name: 'Arrow Down Right',
    category: 'arrows',
    svgDataUrl: svgToDataUrl(icon('<line x1="7" y1="7" x2="17" y2="17"/><polyline points="17 7 17 17 7 17"/>')),
    tags: ['diagonal', 'decline', 'southeast'],
  },
  {
    id: 'icon-refresh',
    name: 'Refresh',
    category: 'arrows',
    svgDataUrl: svgToDataUrl(icon('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>')),
    tags: ['reload', 'sync', 'update', 'cycle'],
  },
  {
    id: 'icon-repeat',
    name: 'Repeat',
    category: 'arrows',
    svgDataUrl: svgToDataUrl(icon('<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>')),
    tags: ['loop', 'cycle', 'recur', 'iterate'],
  },

  // =========================================================================
  // Communication Icons (~10)
  // =========================================================================
  {
    id: 'icon-mail',
    name: 'Email',
    category: 'communication',
    svgDataUrl: svgToDataUrl(icon('<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>')),
    tags: ['email', 'envelope', 'inbox', 'letter'],
  },
  {
    id: 'icon-phone',
    name: 'Phone',
    category: 'communication',
    svgDataUrl: svgToDataUrl(icon('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>')),
    tags: ['call', 'contact', 'mobile', 'telephone'],
  },
  {
    id: 'icon-video',
    name: 'Video',
    category: 'communication',
    svgDataUrl: svgToDataUrl(icon('<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>')),
    tags: ['camera', 'meeting', 'record', 'webinar'],
  },
  {
    id: 'icon-mic',
    name: 'Microphone',
    category: 'communication',
    svgDataUrl: svgToDataUrl(icon('<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>')),
    tags: ['audio', 'podcast', 'speak', 'voice'],
  },
  {
    id: 'icon-megaphone',
    name: 'Megaphone',
    category: 'communication',
    svgDataUrl: svgToDataUrl(icon('<path d="M3 11l18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>')),
    tags: ['announce', 'broadcast', 'marketing', 'speaker'],
  },
  {
    id: 'icon-send',
    name: 'Send',
    category: 'communication',
    svgDataUrl: svgToDataUrl(icon('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>')),
    tags: ['submit', 'publish', 'deliver', 'post'],
  },
  {
    id: 'icon-edit',
    name: 'Edit',
    category: 'communication',
    svgDataUrl: svgToDataUrl(icon('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>')),
    tags: ['write', 'compose', 'modify', 'pencil'],
  },
  {
    id: 'icon-headphones',
    name: 'Headphones',
    category: 'communication',
    svgDataUrl: svgToDataUrl(icon('<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>')),
    tags: ['audio', 'listen', 'music', 'support'],
  },
  {
    id: 'icon-rss',
    name: 'RSS Feed',
    category: 'communication',
    svgDataUrl: svgToDataUrl(icon('<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>')),
    tags: ['feed', 'subscribe', 'blog', 'news'],
  },
  {
    id: 'icon-wifi',
    name: 'Wifi',
    category: 'communication',
    svgDataUrl: svgToDataUrl(icon('<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>')),
    tags: ['internet', 'connection', 'signal', 'wireless'],
  },

  // =========================================================================
  // Chart Icons (~10)
  // =========================================================================
  {
    id: 'icon-pie-chart',
    name: 'Pie Chart',
    category: 'charts',
    svgDataUrl: svgToDataUrl(icon('<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>')),
    tags: ['analytics', 'data', 'percentage', 'distribution'],
  },
  {
    id: 'icon-line-chart',
    name: 'Line Chart',
    category: 'charts',
    svgDataUrl: svgToDataUrl(icon('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>')),
    tags: ['trend', 'graph', 'data', 'analytics'],
  },
  {
    id: 'icon-bar-chart-2',
    name: 'Bar Chart',
    category: 'charts',
    svgDataUrl: svgToDataUrl(icon('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>')),
    tags: ['analytics', 'statistics', 'data', 'comparison'],
  },
  {
    id: 'icon-activity',
    name: 'Activity',
    category: 'charts',
    svgDataUrl: svgToDataUrl(icon('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>')),
    tags: ['pulse', 'health', 'monitor', 'performance'],
  },
  {
    id: 'icon-percent',
    name: 'Percent',
    category: 'charts',
    svgDataUrl: svgToDataUrl(icon('<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>')),
    tags: ['ratio', 'discount', 'rate', 'proportion'],
  },
  {
    id: 'icon-hash',
    name: 'Hash',
    category: 'charts',
    svgDataUrl: svgToDataUrl(icon('<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>')),
    tags: ['number', 'hashtag', 'count', 'metric'],
  },
  {
    id: 'icon-trending-down',
    name: 'Trending Down',
    category: 'charts',
    svgDataUrl: svgToDataUrl(icon('<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>')),
    tags: ['decline', 'decrease', 'loss', 'down'],
  },
  {
    id: 'icon-database',
    name: 'Database',
    category: 'charts',
    svgDataUrl: svgToDataUrl(icon('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>')),
    tags: ['storage', 'data', 'server', 'backend'],
  },
  {
    id: 'icon-filter',
    name: 'Filter',
    category: 'charts',
    svgDataUrl: svgToDataUrl(icon('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>')),
    tags: ['sort', 'funnel', 'refine', 'segment'],
  },
  {
    id: 'icon-sliders',
    name: 'Sliders',
    category: 'charts',
    svgDataUrl: svgToDataUrl(icon('<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>')),
    tags: ['settings', 'adjust', 'controls', 'configure'],
  },

  // =========================================================================
  // General Icons (~20)
  // =========================================================================
  {
    id: 'icon-check',
    name: 'Check',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<polyline points="20 6 9 17 4 12"/>')),
    tags: ['done', 'complete', 'success', 'yes'],
  },
  {
    id: 'icon-check-circle',
    name: 'Check Circle',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>')),
    tags: ['verified', 'approved', 'confirmed', 'valid'],
  },
  {
    id: 'icon-x',
    name: 'Cross',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>')),
    tags: ['close', 'remove', 'delete', 'cancel'],
  },
  {
    id: 'icon-x-circle',
    name: 'Cross Circle',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>')),
    tags: ['error', 'fail', 'invalid', 'reject'],
  },
  {
    id: 'icon-plus',
    name: 'Plus',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>')),
    tags: ['add', 'create', 'new', 'increase'],
  },
  {
    id: 'icon-minus',
    name: 'Minus',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<line x1="5" y1="12" x2="19" y2="12"/>')),
    tags: ['remove', 'subtract', 'decrease', 'collapse'],
  },
  {
    id: 'icon-search',
    name: 'Search',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>')),
    tags: ['find', 'lookup', 'magnify', 'explore'],
  },
  {
    id: 'icon-settings',
    name: 'Settings',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>')),
    tags: ['gear', 'preferences', 'configure', 'options'],
  },
  {
    id: 'icon-lock',
    name: 'Lock',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>')),
    tags: ['secure', 'password', 'private', 'protect'],
  },
  {
    id: 'icon-unlock',
    name: 'Unlock',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>')),
    tags: ['open', 'access', 'public', 'free'],
  },
  {
    id: 'icon-eye',
    name: 'Eye',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>')),
    tags: ['view', 'visibility', 'see', 'watch'],
  },
  {
    id: 'icon-eye-off',
    name: 'Eye Off',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>')),
    tags: ['hidden', 'invisible', 'hide', 'private'],
  },
  {
    id: 'icon-download',
    name: 'Download',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>')),
    tags: ['save', 'export', 'get', 'install'],
  },
  {
    id: 'icon-upload',
    name: 'Upload',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>')),
    tags: ['share', 'import', 'send', 'publish'],
  },
  {
    id: 'icon-zap',
    name: 'Zap',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>')),
    tags: ['lightning', 'fast', 'energy', 'power'],
  },
  {
    id: 'icon-shield',
    name: 'Shield',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>')),
    tags: ['security', 'protect', 'defense', 'safe'],
  },
  {
    id: 'icon-flag',
    name: 'Flag',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>')),
    tags: ['milestone', 'mark', 'important', 'goal'],
  },
  {
    id: 'icon-compass',
    name: 'Compass',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>')),
    tags: ['navigate', 'explore', 'direction', 'discover'],
  },
  {
    id: 'icon-coffee',
    name: 'Coffee',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>')),
    tags: ['break', 'drink', 'morning', 'energy'],
  },
  {
    id: 'icon-map-pin',
    name: 'Map Pin',
    category: 'general',
    svgDataUrl: svgToDataUrl(icon('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>')),
    tags: ['location', 'place', 'address', 'pin'],
  },
];
