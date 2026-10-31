import { LICENSE_BACKEND_URL } from '../../shared/config.js';
export class LicenseService {
    storage;
    backendUrl;
    validationInterval = null;
    constructor(storage, backendUrl = LICENSE_BACKEND_URL) {
        this.storage = storage;
        this.backendUrl = backendUrl;
    }
    /**
     * Initialize license manager on app startup
     */
    async initialize() {
        console.log('[LicenseService] Subscription check bypassed for development');
        return true;
    }
    /**
     * Store license key locally (hashed for security)
     */
    async storeLicense(key, expiresAt) {
        console.log('[LicenseService] License stored (dev bypass)');
    }
    /**
     * Get stored license
     */
    async getStoredLicense() {
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
    async validateLicense(key) {
        console.log('[LicenseService] Validation bypassed for development');
        return true;
    }
    /**
     * Start periodic validation (every 1 hour)
     */
    startPeriodicValidation() {
        // No-op for development
    }
    /**
     * Handle license expiry
     */
    async handleLicenseExpiry() {
        // No-op for development
    }
    /**
     * Clear stored license
     */
    async clearLicense() {
        console.log('[LicenseService] License clear ignored (dev bypass)');
    }
    /**
     * Check if license is valid without forcing validation
     */
    async isLicenseValid() {
        console.log('[LicenseService] License check bypassed (true)');
        return true;
    }
    /**
     * Get remaining days in subscription
     */
    async getRemainingDays() {
        const license = await this.getStoredLicense();
        if (!license)
            return 0;
        const remainingMs = license.expiresAt - Date.now();
        const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
        return Math.max(0, remainingDays);
    }
    /**
     * Cleanup on app quit
     */
    destroy() {
        if (this.validationInterval) {
            clearInterval(this.validationInterval);
            this.validationInterval = null;
        }
        console.log('[LicenseService] Cleanup complete');
    }
}
