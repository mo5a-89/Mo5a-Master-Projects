/**
 * Dynamic Routing & Active Hyperlink Governance Service
 * Ensures live, self-updating platform URLs across deployments (Dev, Preview, Production)
 * and deep links synchronization for all enterprise modules.
 */

import { User, UserRole } from '../types';
import { canAccessTab } from './rbacUtils';

export interface RouteState {
  tab: string;
  projectId?: string | null;
  quotationId?: string | null;
  invoiceId?: string | null;
  deliveryNoteId?: string | null;
  purchaseOrderId?: string | null;
}

export const APP_BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

/**
 * Returns the currently active, live base URL of the application.
 * Dynamically resolves against the client's current browser location to guarantee
 * zero dead links (404s) after deployment or custom domain assignment.
 */
export function getPlatformBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    if (origin && origin !== 'null' && !origin.startsWith('file:')) {
      return origin.replace(/\/+$/, '');
    }
  }

  // Fallback to Vite environment configuration if available
  const envUrl = (import.meta as any).env?.VITE_APP_URL || (import.meta as any).env?.APP_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.startsWith('http')) {
    return envUrl.replace(/\/+$/, '');
  }

  return APP_BASE_URL;
}

/**
 * Construct an active, dynamic hyperlink with deep-linking parameters
 */
export function buildAppUrl(params?: Partial<RouteState>): string {
  const baseUrl = getPlatformBaseUrl();
  if (!params || Object.keys(params).length === 0) {
    return baseUrl;
  }

  const queryParts: string[] = [];
  if (params.tab) {
    queryParts.push(`tab=${encodeURIComponent(params.tab)}`);
  }
  if (params.projectId) {
    queryParts.push(`project=${encodeURIComponent(params.projectId)}`);
  }
  if (params.quotationId) {
    queryParts.push(`quote=${encodeURIComponent(params.quotationId)}`);
  }
  if (params.invoiceId) {
    queryParts.push(`inv=${encodeURIComponent(params.invoiceId)}`);
  }
  if (params.purchaseOrderId) {
    queryParts.push(`po=${encodeURIComponent(params.purchaseOrderId)}`);
  }
  if (params.deliveryNoteId) {
    queryParts.push(`dn=${encodeURIComponent(params.deliveryNoteId)}`);
  }

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  return queryString ? `${baseUrl}/${queryString}`.replace(/\/+\?/, '/?') : baseUrl;
}

/**
 * Parse the current browser URL (search query or hash) into a structured RouteState
 */
export function parseUrlRoute(): RouteState {
  if (typeof window === 'undefined') {
    return { tab: 'dashboard' };
  }

  try {
    let search = window.location.search;
    // Also check hash for SPA fallback if query is empty: e.g. #/projects?id=123 or #tab=projects
    if (!search && window.location.hash) {
      const hashContent = window.location.hash.replace(/^#\/?/, '');
      if (hashContent.includes('?')) {
        search = '?' + hashContent.split('?')[1];
      } else if (hashContent.includes('=')) {
        search = '?' + hashContent;
      } else if (hashContent) {
        return { tab: hashContent };
      }
    }

    const params = new URLSearchParams(search);
    const tab = params.get('tab') || 'dashboard';
    const projectId = params.get('project') || params.get('id') || params.get('projectId') || null;
    const quotationId = params.get('quote') || params.get('quotationId') || null;
    const invoiceId = params.get('inv') || params.get('invoiceId') || null;
    const deliveryNoteId = params.get('dn') || params.get('deliveryNoteId') || null;
    const purchaseOrderId = params.get('po') || params.get('purchaseOrderId') || null;

    return {
      tab,
      projectId,
      quotationId,
      invoiceId,
      deliveryNoteId,
      purchaseOrderId,
    };
  } catch (err) {
    console.warn('[DynamicRouter] Failed parsing URL route:', err);
    return { tab: 'dashboard' };
  }
}

/**
 * Updates browser history seamlessly without triggering page reloads
 */
export function syncUrlRoute(route: RouteState) {
  if (typeof window === 'undefined') return;

  try {
    const params = new URLSearchParams();
    if (route.tab && route.tab !== 'dashboard') {
      params.set('tab', route.tab);
    }
    if (route.projectId) {
      params.set('project', route.projectId);
    }
    if (route.quotationId) {
      params.set('quote', route.quotationId);
    }
    if (route.invoiceId) {
      params.set('inv', route.invoiceId);
    }
    if (route.purchaseOrderId) {
      params.set('po', route.purchaseOrderId);
    }
    if (route.deliveryNoteId) {
      params.set('dn', route.deliveryNoteId);
    }

    const queryString = params.toString();
    const newRelativePathQuery = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    window.history.replaceState({ route }, '', newRelativePathQuery);
  } catch (err) {
    console.warn('[DynamicRouter] Could not sync URL history:', err);
  }
}

/**
 * Determines the authoritative default landing tab for each enterprise role
 */
export function getDefaultLandingTabForRole(role?: UserRole): string {
  switch (role) {
    case 'admin':
      return 'dashboard';
    case 'pm':
      return 'projects';
    case 'engineer':
      return 'projects';
    case 'accountant':
      return 'invoices';
    case 'procurement':
      return 'procurement_mgmt';
    case 'estimator':
      return 'estimating_workbench';
    case 'viewer':
    default:
      return 'dashboard';
  }
}

/**
 * Evaluates whether a requested destination tab is permitted for a user,
 * returning either the requested tab or the role's safe landing tab.
 */
export function resolveSafeUserDestination(user: User | null, requestedTab?: string): string {
  if (!user) return 'dashboard';
  if (requestedTab && canAccessTab(user, requestedTab)) {
    return requestedTab;
  }
  return getDefaultLandingTabForRole(user.role);
}
