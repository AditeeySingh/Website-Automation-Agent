/**
 * BrowserTools — All 7 required browser automation tools.
 *
 * Each tool is a thin wrapper around Playwright, providing the exact
 * interface the assignment requires:
 *
 *   1. open_browser      — Launch a headed Chromium instance
 *   2. navigate_to_url   — Go to a URL and wait for load
 *   3. take_screenshot    — Capture the viewport as base64 PNG
 *   4. click_on_screen    — Click at (x, y) pixel coordinates
 *   5. double_click       — Double-click at (x, y)
 *   6. send_keys          — Type text into the focused element
 *   7. scroll             — Scroll the page up or down
 *
 * Design note: We use coordinate-based clicking (mouse.click) rather
 * than CSS selectors because the AI agent identifies elements visually
 * from screenshots — it reasons in pixel space, not DOM space.
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";

export class BrowserTools {
  /**
   * @param {object} options
   * @param {string}  [options.screenshotDir="screenshots"] — Where to save screenshots.
   * @param {number}  [options.viewportWidth=1280]  — Browser width in pixels.
   * @param {number}  [options.viewportHeight=720]  — Browser height in pixels.
   * @param {object}  [options.logger]              — Logger instance.
   */
  constructor(options = {}) {
    this.screenshotDir = options.screenshotDir || "screenshots";
    this.viewportWidth = options.viewportWidth || 1280;
    this.viewportHeight = options.viewportHeight || 720;
    this.logger = options.logger || console;

    this.browser = null;
    this.context = null;
    this.page = null;
    this.screenshotCount = 0;
  }

  // ─── 1. open_browser ────────────────────────────────────────────────

  /**
   * Launch a headed Chromium browser so you can watch the agent work.
   * Creates the screenshot directory if it doesn't exist.
   *
   * @returns {Promise<string>} Confirmation message.
   */
  async openBrowser() {
    // Ensure screenshot directory exists
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }

    this.browser = await chromium.launch({
      headless: process.env.HEADLESS === "true", // Headed locally, headless on GitHub Actions
      args: [
        `--window-size=${this.viewportWidth},${this.viewportHeight}`,
        "--disable-blink-features=AutomationControlled", // Less bot-like
      ],
    });

    this.context = await this.browser.newContext({
      viewport: {
        width: this.viewportWidth,
        height: this.viewportHeight,
      },
      // Identify as a regular Chrome browser
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/125.0.0.0 Safari/537.36",
    });

    this.page = await this.context.newPage();

    this.logger.success?.(
      `Browser opened (${this.viewportWidth}×${this.viewportHeight})`
    );
    return `Browser launched with viewport ${this.viewportWidth}×${this.viewportHeight}`;
  }

  // ─── 2. navigate_to_url ─────────────────────────────────────────────

  /**
   * Navigate to a URL and wait for the page to fully load.
   *
   * @param {string} url — The URL to navigate to.
   * @returns {Promise<string>} Page title after navigation.
   */
  async navigateToUrl(url) {
    this._ensurePage();
    await this.page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Give dynamic content (React, etc.) a moment to render
    await this.page.waitForTimeout(2000);

    const title = await this.page.title();
    this.logger.success?.(`Navigated to: ${url} (title: "${title}")`);
    return `Navigated to ${url}. Page title: "${title}"`;
  }

  // ─── 3. take_screenshot ─────────────────────────────────────────────

  /**
   * Capture a screenshot of the current viewport.
   * Saves the image to disk AND returns base64 for the AI to analyze.
   *
   * @returns {Promise<{ base64: string, path: string }>}
   */
  async takeScreenshot() {
    this._ensurePage();

    this.screenshotCount++;
    const filename = `step_${String(this.screenshotCount).padStart(3, "0")}.png`;
    const filepath = path.join(this.screenshotDir, filename);

    // Capture the visible viewport (not full page — matches what the user sees)
    const buffer = await this.page.screenshot({ type: "png" });

    // Save to disk for review later
    fs.writeFileSync(filepath, buffer);

    // Convert to base64 for sending to Gemini
    const base64 = buffer.toString("base64");

    this.logger.info?.(`Screenshot saved: ${filepath}`);
    return { base64, path: filepath };
  }

  // ─── 4. click_on_screen ─────────────────────────────────────────────

  /**
   * Click at specific pixel coordinates on the page.
   *
   * @param {number} x — Horizontal pixel position.
   * @param {number} y — Vertical pixel position.
   * @returns {Promise<string>} Confirmation message.
   */
  async clickOnScreen(x, y) {
    this._ensurePage();
    await this.page.mouse.click(x, y);

    // Brief pause to let the page react to the click
    await this.page.waitForTimeout(500);

    this.logger.action?.("click_on_screen", { x, y });
    return `Clicked at coordinates (${x}, ${y})`;
  }

  // ─── 5. double_click ────────────────────────────────────────────────

  /**
   * Double-click at specific pixel coordinates.
   *
   * @param {number} x — Horizontal pixel position.
   * @param {number} y — Vertical pixel position.
   * @returns {Promise<string>} Confirmation message.
   */
  async doubleClick(x, y) {
    this._ensurePage();
    await this.page.mouse.dblclick(x, y);
    await this.page.waitForTimeout(500);

    this.logger.action?.("double_click", { x, y });
    return `Double-clicked at coordinates (${x}, ${y})`;
  }

  // ─── 6. send_keys ──────────────────────────────────────────────────

  /**
   * Type text into the currently focused element.
   * Also supports special keys like "Enter", "Tab", "Backspace".
   *
   * @param {string} text — The text to type, or a special key name.
   * @returns {Promise<string>} Confirmation message.
   */
  async sendKeys(text) {
    this._ensurePage();

    // Check if it's a special key (Enter, Tab, Escape, etc.)
    const specialKeys = [
      "Enter",
      "Tab",
      "Escape",
      "Backspace",
      "Delete",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
    ];

    if (specialKeys.includes(text)) {
      await this.page.keyboard.press(text);
      this.logger.action?.("send_keys", { key: text });
      return `Pressed special key: ${text}`;
    }

    // Type regular text character by character (more human-like)
    await this.page.keyboard.type(text, { delay: 50 });

    this.logger.action?.("send_keys", { text });
    return `Typed: "${text}"`;
  }

  // ─── 7. scroll ─────────────────────────────────────────────────────

  /**
   * Scroll the page up or down by a specified number of pixels.
   *
   * @param {string} direction — "up" or "down".
   * @param {number} [amount=400] — Pixels to scroll.
   * @returns {Promise<string>} Confirmation message.
   */
  async scroll(direction = "down", amount = 400) {
    this._ensurePage();

    const delta = direction === "up" ? -amount : amount;
    await this.page.mouse.wheel(0, delta);

    // Wait for any lazy-loaded content to appear
    await this.page.waitForTimeout(800);

    this.logger.action?.("scroll", { direction, amount });
    return `Scrolled ${direction} by ${amount} pixels`;
  }

  // ─── Utility methods ───────────────────────────────────────────────

  /**
   * Return the current viewport dimensions.
   * Used by the Gemini client to help it reason about coordinates.
   */
  getViewportSize() {
    return { width: this.viewportWidth, height: this.viewportHeight };
  }

  /**
   * Gracefully close the browser.
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.context = null;
      this.logger.info?.("Browser closed");
    }
  }

  /**
   * Internal guard — make sure the browser is open before acting.
   * @private
   */
  _ensurePage() {
    if (!this.page) {
      throw new Error(
        "Browser not open. Call openBrowser() first."
      );
    }
  }
}
