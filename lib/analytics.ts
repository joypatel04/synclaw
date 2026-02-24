/**
 * Umami Analytics Utility Functions
 * Safely tracks events using Umami analytics
 */

export function trackEvent(eventName: string, eventData?: Record<string, any>) {
  if (typeof window !== 'undefined' && window.umami) {
    try {
      window.umami.track(eventName, eventData);
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }
}

// Predefined analytics events for common actions
export const analyticsEvents = {
  // User authentication
  signup: () => trackEvent('Signup'),
  login: () => trackEvent('Login'),
  logout: () => trackEvent('Logout'),

  // CTA and conversion
  ctaClick: (button: string, location: string) =>
    trackEvent('CTA Click', { button, location }),

  // File downloads
  download: (type: string, filename: string) =>
    trackEvent('Download', { type, filename }),

  // Contact and forms
  contactSubmit: () => trackEvent('Contact Form Submit'),
  formSubmit: (formName: string) =>
    trackEvent('Form Submit', { form: formName }),

  // Navigation and links
  externalLink: (url: string, section: string) =>
    trackEvent('External Link', { url, section }),
  internalLink: (page: string, section: string) =>
    trackEvent('Internal Link', { page, section }),

  // Content engagement
  blogView: (slug: string) =>
    trackEvent('Blog View', { slug }),
  blogShare: (slug: string, platform: string) =>
    trackEvent('Blog Share', { slug, platform }),

  // Agent-specific events
  agentStart: (agentName: string) =>
    trackEvent('Agent Start', { agent: agentName }),
  agentComplete: (agentName: string, durationMs: number) =>
    trackEvent('Agent Complete', { agent: agentName, duration: durationMs }),
  agentError: (agentName: string, error: string) =>
    trackEvent('Agent Error', { agent: agentName, error }),

  // Task management
  taskCreate: () => trackEvent('Task Create'),
  taskComplete: () => trackEvent('Task Complete'),
  taskUpdate: () => trackEvent('Task Update'),

  // Feature usage
  featureUse: (featureName: string) =>
    trackEvent('Feature Use', { feature: featureName }),

  // Search
  search: (query: string, resultsCount: number) =>
    trackEvent('Search', { query, results: resultsCount }),
};

export default analyticsEvents;
