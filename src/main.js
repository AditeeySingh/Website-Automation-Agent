/**
 * Main Entry Point — Website Automation Agent
 *
 * This file is what you run with `npm start`. It:
 *   1. Loads environment variables (.env file)
 *   2. Validates the Gemini API key is present
 *   3. Defines the target task
 *   4. Creates and runs the Agent
 *   5. Prints a summary of what happened
 *
 * Usage:
 *   npm start           — Run normally
 *   npm run demo        — Run with verbose (extra-detailed) logging
 */

import "dotenv/config";
import { Agent } from "./agent.js";
import { createLogger } from "./logger.js";

// ─── Configuration ────────────────────────────────────────────────────

/** The URL the agent will navigate to */
const TARGET_URL = "https://ui.shadcn.com/docs/forms/react-hook-form";

/**
 * The natural-language task description.
 * This is sent to Gemini so it knows what to do.
 * Be specific — the more detail, the better the AI performs.
 */
const TASK_DESCRIPTION = `
Navigate to the page and find the interactive form preview section.
There is a "Bug Report" form card that has two fields that need to be filled:

1. **Bug Title field**: Find the input field labeled "Bug Title". Click on it and type "Login page fails on mobile Chrome".
2. **Description field**: Find the Textarea field labeled "Description". Click on it and type "The login page does not load styling and buttons are unclickable when opened on mobile Google Chrome browser.".

After filling both fields, click the "Submit" button to submit the form.

Important notes:
- The form is inside a preview/demo card on the documentation page — you may need to scroll down to find it.
- Make sure to click on each field BEFORE typing into it.
- The page may have multiple code examples — look for the INTERACTIVE "Bug Report" form preview, not the code block.
`.trim();

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  // Create the logger
  const logger = createLogger({
    verbose: process.env.LOG_LEVEL === "verbose",
  });

  // Check for API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_api_key_here") {
    logger.error("GEMINI_API_KEY is not set!");
    logger.info("To fix this:");
    logger.info("  1. Go to https://aistudio.google.com/apikey");
    logger.info("  2. Create a free API key");
    logger.info('  3. Create a .env file with: GEMINI_API_KEY=your_key_here');
    logger.info("  (Or copy .env.example to .env and fill in the key)");
    process.exit(1);
  }

  logger.info("🚀 Website Automation Agent");
  logger.info(`Target: ${TARGET_URL}`);
  logger.info("");

  // Create and run the agent
  const agent = new Agent({
    task: TASK_DESCRIPTION,
    url: TARGET_URL,
    apiKey,
    maxSteps: 20,
    logger,
  });

  try {
    const result = await agent.run();

    // Print summary
    logger.info("");
    logger.info("═══════════════════════════════════════");
    logger.info("           EXECUTION SUMMARY           ");
    logger.info("═══════════════════════════════════════");
    logger.info(`Status:     ${result.success ? "✅ SUCCESS" : "⚠️ INCOMPLETE"}`);
    logger.info(`Steps:      ${result.steps}`);
    logger.info(`Actions:    ${result.history.length}`);
    logger.info("");

    // Print action history table
    logger.info("Action History:");
    for (const entry of result.history) {
      const status = entry.tool === "error" ? "❌" : "✔️";
      logger.info(
        `  ${status} Step ${entry.step}: ${entry.tool}(${JSON.stringify(entry.params)}) → ${entry.result}`
      );
    }

    logger.info("");
    logger.info("Screenshots saved in: ./screenshots/");
    logger.close?.();

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    logger.error(`Fatal error: ${error.message}`);
    logger.error(error.stack);
    logger.close?.();
    process.exit(1);
  }
}

main();
