/**
 * GeminiClient — AI decision-making engine using Google Gemini Vision.
 *
 * This module sends screenshots to Gemini and receives structured JSON
 * instructions for what the agent should do next. It uses Gemini's
 * multimodal (vision) capability to "see" the browser and reason about
 * which element to interact with and what coordinates to click.
 *
 * Model: gemini-2.0-flash — fast, free-tier, supports vision.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * The system prompt that turns Gemini into a browser automation agent.
 * This is the most important part of the project — it defines HOW
 * the AI thinks about browser automation.
 */
const SYSTEM_PROMPT = `You are an expert browser automation agent. You can see a screenshot of a web browser and must decide what action to take next to complete a given task.

## Your Capabilities (Available Tools)
You have these tools to control the browser:

1. **click_on_screen(x, y)** — Click at pixel coordinates (x, y) on the screenshot.
2. **send_keys(text)** — Type text into the currently focused/active input field. Also supports special keys: "Enter", "Tab", "Escape", "Backspace".
3. **scroll(direction, amount)** — Scroll the page. direction is "up" or "down", amount is pixels (default 400, but use 150-200 for small adjustments).
4. **double_click(x, y)** — Double-click at pixel coordinates (x, y).
5. **done** — Signal that the task is complete.

## How to Identify Elements
- Look at the screenshot carefully to find interactive elements (input fields, buttons, links).
- Estimate the CENTER pixel coordinates (x, y) of the element you want to interact with.
- The viewport size will be provided — use it to estimate coordinates accurately.
- Input fields are usually rectangular areas, often with placeholder text or labels above/beside them.
- To fill a form field: FIRST click on it (to focus it), THEN in the next step use send_keys to type.

## Rules
1. Perform ONLY ONE action per response.
2. Always respond with valid JSON — nothing else, no markdown fences, no explanation outside JSON.
3. Before typing into a field, you MUST click on it first to give it focus.
4. If you need to clear existing text in a field before typing, use send_keys("Backspace") multiple times or click_on_screen to select all, then type.
5. If the target element is not visible on the screen, scroll down to find it. If the form is visible but the bottom part (like the Submit button) is slightly cut off at the edge, scroll down by a SMALL amount (e.g. 150 to 200 pixels) so you do not push the form off the top of the screen.
6. After typing, verify in the next screenshot that the text appeared correctly.
7. When ALL parts of the task are complete (the fields are filled and the form has been submitted), use the "done" tool.
8. Target Card Details: For the "Bug Report" form, the fields are "Bug Title" and "Description". The dark "Submit" button is located at the bottom of the card. Once both fields are filled out, look for the dark "Submit" button directly below the Description textarea and click it. Do not scroll up and down repeatedly.

## Response Format
Respond with EXACTLY this JSON structure (no markdown code fences):
{
  "reasoning": "Brief explanation of what you see and why you chose this action",
  "tool": "tool_name",
  "params": { ... }
}

### Examples:
To click on an input field at coordinates (640, 350):
{"reasoning": "I can see the Name input field at roughly the center of the page. I'll click on it to focus it.", "tool": "click_on_screen", "params": {"x": 640, "y": 350}}

To type text after clicking on a field:
{"reasoning": "The Name field is now focused (I can see the cursor). I'll type the name.", "tool": "send_keys", "params": {"text": "John Doe"}}

To scroll down:
{"reasoning": "I cannot see the form fields yet. I need to scroll down to find them.", "tool": "scroll", "params": {"direction": "down", "amount": 400}}

To signal completion:
{"reasoning": "Both the Name and Description fields are filled correctly. The task is complete.", "tool": "done", "params": {}}`;

export class GeminiClient {
  /**
   * @param {string} apiKey — Google Gemini API key.
   * @param {object} [options]
   * @param {string} [options.model="gemini-2.5-flash"] — Model to use.
   * @param {object} [options.logger] — Logger instance.
   */
  constructor(apiKey, options = {}) {
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is required. Get one free at https://aistudio.google.com/apikey"
      );
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: options.model || "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });
    this.logger = options.logger || console;
  }

  /**
   * Send a screenshot to Gemini and get the next action to perform.
   *
   * @param {object} params
   * @param {string} params.screenshotBase64 — Base64-encoded PNG screenshot.
   * @param {string} params.task             — The task description.
   * @param {Array}  params.history          — Array of previous actions taken.
   * @param {object} params.viewport         — { width, height } of the browser.
   * @param {number} params.stepNumber       — Current step number.
   *
   * @returns {Promise<{ reasoning: string, tool: string, params: object }>}
   */
  async decideNextAction({ screenshotBase64, task, history, viewport, stepNumber }) {
    // Build the prompt with context
    const historyText =
      history.length > 0
        ? history
            .map(
              (h, i) =>
                `  Step ${i + 1}: ${h.tool}(${JSON.stringify(h.params)}) → ${h.result}`
            )
            .join("\n")
        : "  (No actions taken yet — this is the first step)";

    const userPrompt = `## Task
${task}

## Current State
- Step number: ${stepNumber}
- Viewport size: ${viewport.width}px × ${viewport.height}px
- Screenshot: attached (below)

## Action History
${historyText}

## Instructions
Analyze the attached screenshot and decide the next single action to take.
Respond with JSON only.`;

    let attempts = 0;
    const maxAttempts = 5;
    let delay = 4000; // start with 4s wait for 429s

    while (attempts < maxAttempts) {
      try {
        attempts++;
        // Send the screenshot as an inline image along with the text prompt
        const result = await this.model.generateContent([
          userPrompt,
          {
            inlineData: {
              mimeType: "image/png",
              data: screenshotBase64,
            },
          },
        ]);

        const responseText = result.response.text().trim();
        this.logger.debug?.(`Gemini raw response: ${responseText}`);

        // Parse the JSON response (isolate the JSON object by finding first '{' and last '}')
        const firstCurly = responseText.indexOf("{");
        const lastCurly = responseText.lastIndexOf("}");
        if (firstCurly === -1 || lastCurly === -1) {
          throw new Error("No JSON object found in response");
        }
        const cleaned = responseText.substring(firstCurly, lastCurly + 1).trim();
        const action = JSON.parse(cleaned);

        // Validate the response has the required fields
        if (!action.tool) {
          throw new Error("Gemini response missing 'tool' field");
        }

        this.logger.thinking?.(action.reasoning || "No reasoning provided");

        return {
          reasoning: action.reasoning || "",
          tool: action.tool,
          params: action.params || {},
        };
      } catch (error) {
        const errorMsg = error.message || "";
        const isRetryable =
          errorMsg.includes("429") ||
          errorMsg.toLowerCase().includes("quota") ||
          errorMsg.includes("503") ||
          errorMsg.toLowerCase().includes("service unavailable") ||
          errorMsg.toLowerCase().includes("high demand") ||
          errorMsg.toLowerCase().includes("overloaded") ||
          errorMsg.toLowerCase().includes("temp");
        
        if (isRetryable && attempts < maxAttempts) {
          this.logger.warn?.(`Gemini transient error (${errorMsg.includes("503") ? "503" : "429"}) hit. Retrying in ${delay / 1000}s... (Attempt ${attempts}/${maxAttempts})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // exponential backoff
        } else {
          this.logger.error?.(`Gemini request failed: ${errorMsg}`);
          throw new Error(`Failed to get action from Gemini: ${errorMsg}`);
        }
      }
    }
  }
}
