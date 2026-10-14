/**
 * Error with a stable machine-readable code.
 * Codes: NO_CONFIG, CONFIG_INVALID, UNKNOWN_CHANNEL, MISSING_TOKEN, MISSING_TEXT,
 * FILE_NOT_FOUND, FILE_TOO_LARGE, CAPTION_TOO_LONG, RICH_TOO_LONG, API_ERROR.
 */
export class TgError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   */
  constructor(message, code) {
    super(message);
    this.name = "TgError";
    this.code = code;
  }
}
