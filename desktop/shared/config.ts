/**
 * The single connection point between this desktop project and the backend project (`../backend`).
 *
 * Set your deployed license server URL here before packaging the app, or override it at runtime
 * with the `LICENSE_BACKEND_URL` environment variable. See ../README.md for deployment.
 */
export const LICENSE_BACKEND_URL = process.env.LICENSE_BACKEND_URL || 'http://localhost:3000';
