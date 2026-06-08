/**
 * Agent — The core "Observe → Think → Act" loop.
 *
 * This is the brain of the automation system. It orchestrates:
 *   1. OBSERVE  — Take a screenshot of the current browser state.
 *   2. THINK    — Send the screenshot to Gemini, which decides the next action.
 *   3. ACT      — Execute the chosen tool (click, type, scroll, etc.).
 *   4. EVALUATE — Check if the task is done or if we should continue.
 *
 * The loop repeats until Gemini signals "done" or we hit the max step limit.
 *
 * Error recovery: If an action fails, the agent takes a fresh screenshot
 * and lets Gemini re-plan from the new state. This makes it resilient
 * to transient failures (elements not yet loaded, wrong coordinates, etc.).
 */

import { BrowserTools } from "./tools.js";
import { GeminiClient } from "./gemini.js";

export class Agent {
  /**
   * @param {object} config
   * @param {string} config.task       — Natural-language task description.
   * @param {string} config.url        — Starting URL to navigate to.
   * @param {string} config.apiKey     — Gemini API key.
   * @param {number} [config.maxSteps=20]  — Maximum actions before stopping.
   * @param {object} [config.logger]   — Logger instance.
   */
  constructor(config) {
    this.task = config.task;
    this.url = config.url;
    this.maxSteps = config.maxSteps || 20;
    this.logger = config.logger || console;

    // Initialize sub-components
    this.tools = new BrowserTools({ logger: this.logger });
    this.gemini = new GeminiClient(config.apiKey, { logger: this.logger });

    // State tracking
    this.history = [];       // Record of every action taken
    this.currentStep = 0;    // Current step counter
    this.isComplete = false;  // Whether the task was completed
  }

  /**
   * Run the full automation — open browser, navigate, and execute the
   * observe-think-act loop until the task is done.
   *
   * @returns {Promise<{ success: boolean, steps: number, history: Array }>}
   */
  async run() {
    this.logger.info?.("═".repeat(50));
    this.logger.info?.("🤖 Website Automation Agent — Starting");
    this.logger.info?.("═".repeat(50));
    this.logger.info?.(`Task: ${this.task}`);
    this.logger.info?.(`URL:  ${this.url}`);
    this.logger.info?.(`Max steps: ${this.maxSteps}`);
    this.logger.info?.("");

    try {
      // ── Phase 1: Launch browser and navigate ──────────────────
      this.logger.info?.("Phase 1: Opening browser and navigating...");
      await this.tools.openBrowser();
      await this.tools.navigateToUrl(this.url);

      // ── Phase 2: Agent loop ───────────────────────────────────
      this.logger.info?.("Phase 2: Starting agent loop...\n");

      while (this.currentStep < this.maxSteps && !this.isComplete) {
        this.currentStep++;
        this.logger.divider?.(this.currentStep);

        try {
          await this._executeOneStep();
        } catch (stepError) {
          this.logger.error?.(
            `Step ${this.currentStep} failed: ${stepError.message}`
          );

          // Error recovery: take a screenshot so Gemini can see the current
          // state and re-plan. We don't abort — we let the loop continue.
          this.history.push({
            step: this.currentStep,
            tool: "error",
            params: {},
            result: stepError.message,
            reasoning: "Step failed — agent will re-evaluate from new screenshot.",
          });

          // If we've had 3 consecutive errors, something is fundamentally wrong
          const recentErrors = this.history
            .slice(-3)
            .filter((h) => h.tool === "error");
          if (recentErrors.length >= 3) {
            this.logger.error?.("3 consecutive errors — aborting.");
            break;
          }
        }
      }

      // ── Phase 3: Results ──────────────────────────────────────
      this.logger.info?.("\n" + "═".repeat(50));
      if (this.isComplete) {
        this.logger.success?.(
          `✅ Task completed successfully in ${this.currentStep} steps!`
        );
      } else {
        this.logger.warn?.(
          `⚠️ Reached max steps (${this.maxSteps}) without completing the task.`
        );
      }
      this.logger.info?.("═".repeat(50));

      return {
        success: this.isComplete,
        steps: this.currentStep,
        history: this.history,
      };
    } finally {
      // Always close the browser, even if something went wrong
      await this.tools.closeBrowser();
    }
  }

  /**
   * Execute a single Observe → Think → Act cycle.
   * @private
   */
  async _executeOneStep() {
    // ── OBSERVE: Take a screenshot ──────────────────────────────
    this.logger.info?.("📸 Taking screenshot...");
    const screenshot = await this.tools.takeScreenshot();
    const viewport = this.tools.getViewportSize();

    // ── THINK: Ask Gemini what to do ────────────────────────────
    this.logger.info?.("🤔 Asking Gemini for next action...");
    const decision = await this.gemini.decideNextAction({
      screenshotBase64: screenshot.base64,
      task: this.task,
      history: this.history,
      viewport,
      stepNumber: this.currentStep,
    });

    this.logger.info?.(`Gemini chose: ${decision.tool}`);
    this.logger.thinking?.(decision.reasoning);

    // ── ACT: Execute the chosen tool ────────────────────────────
    const result = await this._executeTool(decision.tool, decision.params);

    // ── Record this step in history ─────────────────────────────
    this.history.push({
      step: this.currentStep,
      tool: decision.tool,
      params: decision.params,
      result,
      reasoning: decision.reasoning,
    });
  }

  /**
   * Dispatch a tool call to the appropriate BrowserTools method.
   *
   * @param {string} tool   — Tool name from Gemini's decision.
   * @param {object} params — Parameters for the tool.
   * @returns {Promise<string>} Result message.
   * @private
   */
  async _executeTool(tool, params) {
    switch (tool) {
      case "click_on_screen":
        return await this.tools.clickOnScreen(
          Math.round(params.x),
          Math.round(params.y)
        );

      case "double_click":
        return await this.tools.doubleClick(
          Math.round(params.x),
          Math.round(params.y)
        );

      case "send_keys":
        return await this.tools.sendKeys(params.text);

      case "scroll":
        return await this.tools.scroll(
          params.direction || "down",
          params.amount || 400
        );

      case "navigate_to_url":
        return await this.tools.navigateToUrl(params.url);

      case "done":
        this.isComplete = true;
        this.logger.success?.("🎉 Gemini signaled task completion!");
        // Take a final screenshot as proof of completion
        await this.tools.takeScreenshot();
        return "Task marked as complete";

      default:
        throw new Error(`Unknown tool: "${tool}"`);
    }
  }
}
