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

const configPath = path.join(__dirname, "config.yml");
const config = yaml.load(fs.readFileSync(configPath, "utf8"));

console.log(`\n Event: ${eventKey}`);
console.log(`PR: #${prNumber} in ${repoOwner}/${repoName}\n`);

const matchedRules = config.rules.filter((rule) => rule.event === eventKey);

if (matchedRules.length === 0) {
  console.log("No rules matched. Nothing to do.");
  process.exit(0);
}

console.log(`Matched ${matchedRules.length} rule(s):\n`);
matchedRules.forEach((r, i) => console.log(`  [${i + 1}] action: ${r.action}`));
console.log();

async function addLabel(label) {
  console.log(`Adding label: "${label}"`);
  await octokit.issues.addLabels({
    owner: repoOwner,
    repo: repoName,
    issue_number: prNumber,
    labels: [label],
  });
  console.log(`   ✓ Label added.\n`);
}

async function addComment(message) {
  console.log(`Posting comment...`);
  await octokit.issues.createComment({
    owner: repoOwner,
    repo: repoName,
    issue_number: prNumber,
    body: message.trim(),
  });
  console.log(`Comment posted.\n`);
}

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
        console.warn(`Unknown action: "${rule.action}" — skipping.`);
    }
  }
  console.log("All actions complete.");
}

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});