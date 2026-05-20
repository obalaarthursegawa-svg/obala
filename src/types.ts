/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface IntruderLog {
  id: string;
  imageUrl: string;
  image_url?: string;
  timestamp: string;
  ipAddress: string;
  ip_address?: string;
  deviceInfo: string;
  device_info?: string;
  failedAttempts: number;
  failed_attempts?: number;
}

export interface VaultItem {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  created_at?: string;
}

export interface VaultStatus {
  isLocked: boolean;
  cooldownUntil: string | null;
  failedAttempts: number;
  isSupabaseConnected: boolean;
  rateLimitMax: number;
}
