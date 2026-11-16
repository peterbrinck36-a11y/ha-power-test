/**
 * Password policy shared by server actions, client forms, and tests.
 * Kept free of Node built-ins so client components can import it.
 */

/** Minimum length for a password chosen by the user (or set by an admin). */
export const MIN_PASSWORD_LENGTH = 8;

/** Temporary passwords stop working after this long. */
export const TEMP_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
