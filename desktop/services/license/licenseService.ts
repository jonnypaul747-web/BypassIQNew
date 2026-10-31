import crypto from 'crypto';
import { LocalStorageManager } from '../storage/localStore.js';
import { LICENSE_BACKEND_URL } from '../../shared/config.js';

export interface LicenseInfo {
  key: string;
  expiresAt: number;
  isValid: boolean;
  lastChecked: number;
}

export class LicenseService {
  private storage: LocalStorageManager;
  private backendUrl: string;
  private validationInterval: NodeJS.Timeout | null = null;

  constructor(storage: LocalStorageManager, backendUrl: string = LICENSE_BACKEND_URL) {
    this.storage = storage;
    this.backendUrl = backendUrl;
  }

  /**
   * Initialize license manager on app startup
   */
  async initialize(): Promise<boolean> {
    console.log('[LicenseService] Subscription check bypassed for development');
    return true;
  }

  /**
   * Store license key locally (hashed for security)
   */
  async storeLicense(key: string, expiresAt: number): Promise<void> {
    console.log('[LicenseService] License stored (dev bypass)');
  }

  /**
   * Get stored license
   */
  async getStoredLicense(): Promise<LicenseInfo | null> {
    return {
        key: 'DEV_BYPASS',
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
        isValid: true,
        lastChecked: Date.now()
    };
  }

  /**
   * Validate license with backend server
   */
  async validateLicense(key: string): Promise<boolean> {
    console.log('[LicenseService] Validation bypassed for development');
    return true;
  }

  /**
   * Start periodic validation (every 1 hour)
   */
  private startPeriodicValidation(): void {
    // No-op for development
  }

  /**
   * Handle license expiry
   */
  private async handleLicenseExpiry(): Promise<void> {
    // No-op for development
  }

  /**
   * Clear stored license
   */
  async clearLicense(): Promise<void> {
    console.log('[LicenseService] License clear ignored (dev bypass)');
  }

  /**
   * Check if license is valid without forcing validation
   */
  async isLicenseValid(): Promise<boolean> {
    console.log('[LicenseService] License check bypassed (true)');
    return true;
  }

  /**
   * Get remaining days in subscription
   */
  async getRemainingDays(): Promise<number> {
    const license = await this.getStoredLicense();
    if (!license) return 0;

    const remainingMs = license.expiresAt - Date.now();
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    return Math.max(0, remainingDays);
  }

  /**
   * Cleanup on app quit
   */
  destroy(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }
    console.log('[LicenseService] Cleanup complete');
  }
}
