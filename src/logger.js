/**
 * Logger — Comprehensive action logging for the automation agent.
 *
 * Provides timestamped, color-coded console output and writes persistent
 * log files to the logs/ directory. Every agent action, Gemini decision,
 * and error is recorded for debugging and viva demonstration.
 */

import chalk from "chalk";
import fs from "fs";
import path from "path";

/**
 * Creates a Logger instance that writes to both console and a log file.
 *
 * @param {object} options
 * @param {string} [options.logDir="logs"] — Directory for log files.
 * @param {boolean} [options.verbose=false] — If true, prints extra detail.
 * @returns {{ info, success, warn, error, action, thinking, divider, close }}
 */
export function createLogger(options = {}) {
  const logDir = options.logDir || "logs";
  const verbose = options.verbose || process.env.LOG_LEVEL === "verbose";

  // Ensure the log directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // One log file per run, named with a timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logFile = path.join(logDir, `agent_run_${timestamp}.log`);
  const stream = fs.createWriteStream(logFile, { flags: "a" });

  /**
   * Internal: write a line to both console and the log file.
   */
  function write(level, colorFn, icon, message) {
    const ts = new Date().toISOString();
    const plain = `[${ts}] [${level}] ${icon} ${message}`;

    // Console gets color, file gets plain text
    console.log(colorFn(`  ${icon} ${message}`));
    stream.write(plain + "\n");
  }

  return {
    /** General information */
    info(msg) {
      write("INFO", chalk.cyan, "ℹ", msg);
    },

    /** Successful action */
    success(msg) {
      write("OK", chalk.green, "✔", msg);
    },

    /** Warning */
    warn(msg) {
      write("WARN", chalk.yellow, "⚠", msg);
    },

    /** Error */
    error(msg) {
      write("ERROR", chalk.red, "✖", msg);
    },

    /** Agent action (click, type, scroll, etc.) */
    action(tool, params) {
      const paramStr =
        typeof params === "object" ? JSON.stringify(params) : String(params);
      write("ACTION", chalk.magenta, "▶", `${tool}(${paramStr})`);
    },

    /** Gemini reasoning / thinking */
    thinking(msg) {
      write("THINK", chalk.blue, "🧠", msg);
    },

    /** Visual divider for step boundaries */
    divider(stepNum) {
      const line = "─".repeat(50);
      console.log(chalk.gray(`\n  ${line}`));
      console.log(chalk.white.bold(`  Step ${stepNum}`));
      console.log(chalk.gray(`  ${line}\n`));
      stream.write(`\n${"─".repeat(50)}\nStep ${stepNum}\n${"─".repeat(50)}\n\n`);
    },

    /** Verbose-only logging (for demo mode) */
    debug(msg) {
      if (verbose) {
        write("DEBUG", chalk.gray, "·", msg);
      }
    },

    /** Flush and close the log file */
    close() {
      stream.end();
      console.log(chalk.gray(`\n  📄 Log saved to: ${logFile}\n`));
    },

    /** The path to the current log file */
    logFile,
  };
}
