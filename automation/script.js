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
  console.log(`[AUDIT] ${timestamp} | status=${status} | event=${eventKey} | action=${action} | detail=${detail}`);
}

// ─── LOAD CONFIG ─────────────────────────────────────────────────────────────
let config;
try {
  const configPath = path.join(__dirname, "config.yml");
  config = yaml.load(fs.readFileSync(configPath, "utf8"));
  audit("ok", "load-config", "config.yml loaded successfully");
} catch (err) {
  audit("error", "load-config", err.message);
  process.exit(1);
}

console.log(`\n Event: ${eventKey}`);
console.log(`PR:    #${prNumber} in ${repoOwner}/${repoName}\n`);

// ─── MATCH RULES ─────────────────────────────────────────────────────────────
const matchedRules = config.rules.filter((rule) => rule.event === eventKey);

if (matchedRules.length === 0) {
  audit("skip", "match-rules", "no rules matched");
  console.log("No rules matched. Nothing to do.");
  process.exit(0);
}

audit("ok", "match-rules", `${matchedRules.length} rule(s) matched`);
console.log(`Matched ${matchedRules.length} rule(s):\n`);
matchedRules.forEach((r, i) => console.log(`  [${i + 1}] action: ${r.action}`));
console.log();

// ─── ACTIONS ─────────────────────────────────────────────────────────────────
async function addLabel(label) {
  try {
    console.log(`Adding label: "${label}"`);
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
    console.log(`Posting comment...`);
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

// ─── DISPATCH ────────────────────────────────────────────────────────────────
async function run() {
  for (const rule of matchedRules) {
    switch (rule.action) {
      case "label":
        await addLabel(rule.label);
        break;
      case "comment":
        await addComment(rule.message);
        break;
      default:
        audit("warn", "dispatch", `unknown action "${rule.action}" skipped`);
        console.warn(`Unknown action: "${rule.action}" — skipping.`);
    }
  }
  console.log("All actions complete.");
}

run().catch((err) => {
  audit("error", "run", err.message);
  process.exit(1);
});