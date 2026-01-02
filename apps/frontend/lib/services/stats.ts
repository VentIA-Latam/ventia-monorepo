/**
 * Stats Service
 * Handles platform statistics API calls
 */

export interface PlatformStats {
  total_tenants: number;
  total_users: number;
  active_api_keys: number;
  total_super_admins: number;
}

export interface Activity {
  id: number;
  entity_type: string;
  operation: string;
  description: string;
  timestamp: string;
}

export interface RecentActivityResponse {
  activities: Activity[];
  total: number;
}

/**
 * Get platform statistics (SUPER_ADMIN only)
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const response = await fetch(`/api/superadmin/stats`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch stats" }));
    throw new Error(error.detail || error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get recent platform activity (SUPER_ADMIN only)
 */
export async function getRecentActivity(limit: number = 10): Promise<RecentActivityResponse> {
  const response = await fetch(`/api/superadmin/stats/activity/recent?limit=${limit}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch activity" }));
    throw new Error(error.detail || error.error || `HTTP ${response.status}`);
  }

  return response.json();
}
