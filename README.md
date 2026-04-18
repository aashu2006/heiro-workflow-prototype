# Hiero Workflow Prototype

A small prototype showing how GitHub PR automation can be
config driven, auditable, and easy to scale.

---

## The Problem

Maintainers waste time on repetitive tasks like labeling PRs,
welcoming contributors, and managing issues - done inconsistently
across repos with hardcoded workflows.

---

## How It Works
Event → Config → Decision → Action

- **config.yml** - defines the rules (pure data, no code)
- **script.js** - reads rules, matches event, runs actions
- **GitHub Actions** - triggers the script, handles execution

Change the config, change the behavior. No code touched.

---

## Audit Log

Every decision is logged:
[AUDIT] 2026-04-18T10:23:01Z | status=ok | event=pull_request.opened | action=label | detail=added "needs-review"

---

## Adding a Rule

Only touch `config.yml`:
```yaml
- event: pull_request.opened
  action: comment
  message: "Thanks for your PR!"
```

---

## The Bigger Picture

This prototype uses GitHub Actions as the executor.
The next step is a **GitHub App** as the central orchestrator -
one place to manage permissions, config, and audit trails
across all Hiero repositories.