# Hiero Workflow Automation Prototype

> Config-driven GitHub PR automation - no code changes needed to add new rules.

Built as part of the Hiero LFX Mentorship project.

## The Problem

Hiero maintainers were doing the same things manually across every repo:
- Labeling new PRs
- Welcoming contributors
- Reminding people about DCO sign-offs and GPG signing

This prototype automates all of that, consistently, across every repo.

## How It Works

```
PR opened/labeled/closed
        ↓
  Which repo is this?  →  Load that repo's config
        ↓
  Is this action allowed?  →  Check permissions
        ↓
  Run the matching rules  →  Label it, comment on it
        ↓
  Log everything to the audit trail
```

## What It Can Do

**Events it listens to:**

| Event | When it fires |
|-------|--------------|
| `pull_request.opened` | Someone opens a PR |
| `pull_request.labeled` | A label gets added to a PR |
| `pull_request.closed` | A PR is merged or closed |

**Actions it can take:**

| Action | What happens |
|--------|-------------|
| `label` | Adds a label to the PR |
| `comment` | Posts a comment on the PR |

## Per-repo Config

Each repo gets its own rules file. No config? It falls back to the default.

```
configs/
  hiero-sdk-python.yml   ← custom rules for the Python SDK
  hiero-sdk-cpp.yml      ← custom rules for the C++ SDK (includes GPG + DCO reminders)
  default.yml            ← fallback for everything else
```

## Adding a Rule

Just edit the YAML - no code changes, no deployments:

```yaml
- event: pull_request.opened
  action: comment
  message: "Thanks for the PR! A maintainer will review shortly."
```

## Permission Boundaries

Every config declares exactly what the bot is and isn't allowed to do:

```yaml
permissions:
  allow: [label, comment]
  deny: [close, merge]
```

Even if a rule tries to close or merge a PR, the bot will refuse and log it.

## Audit Log

Every decision the bot makes gets logged - what happened, why, and when:

```
[AUDIT] 2026-04-20T10:23:01Z | status=ok | repo=hiero-sdk-python | event=pull_request.opened | action=label | detail=added "needs-review" to PR #42
```

| Status | Meaning |
|--------|---------|
| `ok` | Action ran successfully |
| `blocked` | Denied by the permissions config |
| `skip` | No rules matched this event |
| `error` | Something went wrong |

The log is saved as a downloadable artifact on every workflow run so nothing gets lost.

## Config Validation

Every config file is validated immediately after loading — before any action runs.

If a rule is missing required fields or has an invalid action type, the bot exits with a clear audit error:

```
[AUDIT] 2026-04-20T10:23:01Z | status=error | repo=hiero-bot | event=pull_request.opened | action=validate-config | detail=Rule 1: action "label" requires a "label" field
```

This means broken configs fail fast and loudly — never silently.

## Where This Is Going

Right now, everything runs inside GitHub Actions - one workflow per repo.

The next step is a **GitHub App** that sits centrally across all Hiero repos:

```
Now:  PR event → Actions Workflow → script.js → GitHub API

Next: PR event → GitHub App → Decision Engine → GitHub API
                                    ↑
                         one place for all configs
                         one place for all permissions
                         one audit trail across every repo
```
