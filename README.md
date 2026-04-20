# Hiero Workflow Automation Prototype

A working prototype demonstrating config-driven, auditable GitHub PR automation.
Built as part of exploring the architecture for the Hiero LFX Mentorship project.

## The Problem

Maintainers across Hiero repos waste time on repetitive tasks like labeling PRs,
welcoming contributors, and managing issues done inconsistently with hardcoded
workflows that are hard to maintain or scale across repositories.

## How It Works
Event -> Per-repo Config -> Permission Check -> Decision -> Action -> Audit Log

- **configs/** - one YAML file per repo, falls back to default
- **script.js** - loads config, checks permissions, matches rules, runs actions
- **GitHub Actions** - triggers the script, handles execution

## Per-repo Config

Each repo can have its own rules:
configs/
hiero-sdk-python.yml
hiero-sdk-cpp.yml
default.yml        ← fallback for any repo without a specific config

## Permission Boundaries

Every config defines what the bot is allowed and not allowed to do:
```yaml
permissions:
  allow: [label, comment]
  deny: [close, merge]
```
Even if a rule tries to run a denied action, the bot blocks it.

## Audit Log

Every decision is logged with timestamp, repo, event, action and result:
[AUDIT] 2026-04-20T10:23:01Z | status=ok | repo=hiero-sdk-python | event=pull_request.opened | action=label | detail=added "needs-review"

## Adding a Rule

Edit the repo's config only - zero code changes:
```yaml
- event: pull_request.opened
  action: comment
  message: "Thanks for your PR!"
```

## The Bigger Picture

This prototype uses GitHub Actions as the executor.
The natural next step is a **GitHub App** as the central orchestrator -
one place to manage permissions, configs, and audit trails across all Hiero repos.
Now:   Event -> Actions Workflow -> script.js -> GitHub API
Next:  Event -> GitHub App -> Decision Engine -> GitHub API
↑
reads per-repo config
manages permissions centrally
audit trail across all repos
