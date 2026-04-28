const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { Octokit } = require("@octokit/rest");

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const [repoOwner, repoName] = (process.env.REPO || "/").split("/");
const prNumber = parseInt(process.env.PR_NUMBER, 10);
const eventName = process.env.EVENT_NAME;
const eventAction = process.env.EVENT_ACTION;
const eventKey = `${eventName}.${eventAction}`;

// ─── AUDIT LOGGER ────────────────────────────────────────────────────────────
function audit(status, action, detail) {
  const timestamp = new Date().toISOString();
  const line = `[AUDIT] ${timestamp} | status=${status} | repo=${repoName} | event=${eventKey} | action=${action} | detail=${detail}`;
  console.log(line);

  // Write to audit log file
  fs.appendFileSync(path.join(__dirname, "audit.log"), line + "\n");
}

// ─── CONFIG VALIDATION ───────────────────────────────────────────────────────
function validateConfig(config, configPath) {
  if (!config || !Array.isArray(config.rules) || config.rules.length === 0) {
    const msg = `${configPath}: "rules" must be a non-empty array`;
    audit("error", "validate-config", msg);
    throw new Error(msg);
  }

  const VALID_ACTIONS = ["label", "comment"];

  for (let i = 0; i < config.rules.length; i++) {
    const rule = config.rules[i];
    const prefix = `${configPath}: rules[${i}]`;

    if (typeof rule.event !== "string" || !rule.event) {
      const msg = `${prefix}: "event" must be a non-empty string`;
      audit("error", "validate-config", msg);
      throw new Error(msg);
    }

    if (typeof rule.action !== "string" || !VALID_ACTIONS.includes(rule.action)) {
      const msg = `${prefix}: "action" must be one of: ${VALID_ACTIONS.join(", ")}`;
      audit("error", "validate-config", msg);
      throw new Error(msg);
    }

    if (rule.action === "label") {
      if (typeof rule.label !== "string" || !rule.label) {
        const msg = `${prefix}: action "label" requires a non-empty "label" field`;
        audit("error", "validate-config", msg);
        throw new Error(msg);
      }
    }

    if (rule.action === "comment") {
      if (typeof rule.message !== "string" || !rule.message) {
        const msg = `${prefix}: action "comment" requires a non-empty "message" field`;
        audit("error", "validate-config", msg);
        throw new Error(msg);
      }
    }
  }

  if (config.permissions !== undefined) {
    if (config.permissions.allow !== undefined && !Array.isArray(config.permissions.allow)) {
      const msg = `${configPath}: "permissions.allow" must be an array`;
      audit("error", "validate-config", msg);
      throw new Error(msg);
    }
    if (config.permissions.deny !== undefined && !Array.isArray(config.permissions.deny)) {
      const msg = `${configPath}: "permissions.deny" must be an array`;
      audit("error", "validate-config", msg);
      throw new Error(msg);
    }
  }
}

// ─── LOAD CONFIG ─────────────────────────────────────────────────────────────
function loadConfig() {
  const repoConfigPath = path.join(__dirname, `../configs/${repoName}.yml`);
  const defaultConfigPath = path.join(__dirname, `../configs/default.yml`);

  // Try repo-specific config first, fall back to default
  if (fs.existsSync(repoConfigPath)) {
    audit("ok", "load-config", `loaded repo-specific config for ${repoName}`);
    const config = yaml.load(fs.readFileSync(repoConfigPath, "utf8"));
    validateConfig(config, repoConfigPath);
    return config;
  }

  audit("ok", "load-config", `no config for ${repoName}, using default`);
  const config = yaml.load(fs.readFileSync(defaultConfigPath, "utf8"));
  validateConfig(config, defaultConfigPath);
  return config;
}

// ─── PERMISSION CHECK ────────────────────────────────────────────────────────
function isAllowed(action, permissions = {}) {
  if (permissions.deny && permissions.deny.includes(action)) {
    audit("blocked", "permission-check", `action "${action}" is in deny list`);
    return false;
  }
  if (permissions.allow && !permissions.allow.includes(action)) {
    audit("blocked", "permission-check", `action "${action}" is not in allow list`);
    return false;
  }
  return true;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function run() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    audit("error", "load-config", err.message);
    process.exit(1);
  }

  console.log(`\n📋 Event:  ${eventKey}`);
  console.log(`📦 Repo:   ${repoOwner}/${repoName}`);
  console.log(`🔢 PR:     #${prNumber}\n`);

  // Match rules for this event
  const matchedRules = config.rules.filter((rule) => rule.event === eventKey);

  if (matchedRules.length === 0) {
    audit("skip", "match-rules", "no rules matched");
    console.log("⏭️  No rules matched. Nothing to do.");
    process.exit(0);
  }

  audit("ok", "match-rules", `${matchedRules.length} rule(s) matched`);
  console.log(`✅ Matched ${matchedRules.length} rule(s)\n`);

  // Execute each matched rule
  for (const rule of matchedRules) {

    // Check permissions before running any action
    if (!isAllowed(rule.action, config.permissions)) {
      console.warn(`🚫 Action "${rule.action}" blocked by permissions.`);
      continue;
    }

    switch (rule.action) {
      case "label":
        await addLabel(rule.label);
        break;
      case "comment":
        await addComment(rule.message);
        break;
      default:
        audit("warn", "dispatch", `unknown action "${rule.action}" skipped`);
        console.warn(`⚠️  Unknown action: "${rule.action}" — skipping.`);
    }
  }

  console.log("🎉 All actions complete.");
}

// ─── ACTIONS ─────────────────────────────────────────────────────────────────
async function addLabel(label) {
  try {
    console.log(`🏷️  Adding label: "${label}"`);
    await octokit.issues.addLabels({
      owner: repoOwner,
      repo: repoName,
      issue_number: prNumber,
      labels: [label],
    });
    audit("ok", "label", `added "${label}" to PR #${prNumber}`);
    console.log(`   ✓ Label added.\n`);
  } catch (err) {
    audit("error", "label", err.message);
    console.error(`   ✗ Failed to add label: ${err.message}`);
  }
}

async function addComment(message) {
  try {
    console.log(`💬 Posting comment...`);
    await octokit.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: prNumber,
      body: message.trim(),
    });
    audit("ok", "comment", `comment posted to PR #${prNumber}`);
    console.log(`   ✓ Comment posted.\n`);
  } catch (err) {
    audit("error", "comment", err.message);
    console.error(`   ✗ Failed to post comment: ${err.message}`);
  }
}

run().catch((err) => {
  audit("error", "run", err.message);
  process.exit(1);
});