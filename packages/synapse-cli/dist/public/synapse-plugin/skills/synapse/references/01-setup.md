# Setup: MCP Configuration

## Overview

Configure the Synapse MCP server so your AI agent can communicate with the platform.

---

## 1. Create an API Key

API keys are created in the Synapse web UI.

**Steps:**

1. Open Synapse in a browser (for example `http://localhost:3000`)
2. Navigate to **Agents** in the sidebar
3. Create or open the agent Claude Code should use
4. Generate / copy the agent's API key
5. Save the key immediately because it is shown only once

The API key is prefixed with `syn_` (for example `syn_PXPnHpnmmYk8...`).

If you do not have an API key yet:

> I need a Synapse API key to connect to the platform. Please create one on the Agents page and share the key with me.

---

## 2. MCP Server Configuration

Synapse MCP uses the HTTP Streamable transport. There are two pieces of configuration that need to agree:

1. **`.mcp.json`** at the project root (or global `~/.claude/.mcp.json`) declares the MCP server using env-variable placeholders.
2. **Env variables** (`SYNAPSE_URL`, `SYNAPSE_API_KEY`) supply the real values at runtime. They live in `~/.claude/settings.json`'s `env` block, in `<project>/.claude/settings.json`'s `env` block, or in your shell environment.

You do **not** put the real URL/key in `.mcp.json` and again in `settings.json`. Pick one place for the env values, leave `.mcp.json` as the placeholder template.

The plugin ships the placeholder template at `public/synapse-plugin/.mcp.json`:

```json
{
  "mcpServers": {
    "synapse": {
      "type": "http",
      "url": "${SYNAPSE_URL}/api/mcp",
      "headers": {
        "Authorization": "Bearer ${SYNAPSE_API_KEY}"
      }
    }
  }
}
```

Then add the env values once. Example via `~/.claude/settings.json`:

```json
{
  "env": {
    "SYNAPSE_URL": "http://localhost:3000",
    "SYNAPSE_API_KEY": "syn_..."
  }
}
```

If you prefer to avoid env indirection, you can substitute the values directly into `.mcp.json` (replace `${SYNAPSE_URL}` and `${SYNAPSE_API_KEY}` with the literal strings) — but make sure that file is not committed to git.

Restart Claude Code after configuration so MCP picks up the new server and the plugin's bash hooks see the env variables.

### Optional: Project Filtering

Scope the agent to specific projects using headers:

| Header | Format | Effect |
|--------|--------|--------|
| `X-Synapse-Project` | UUID or comma-separated UUIDs | Only these projects |
| `X-Synapse-Project-Group` | Group UUID | All projects in the group |

```json
{
  "mcpServers": {
    "synapse": {
      "type": "http",
      "url": "<BASE_URL>/api/mcp",
      "headers": {
        "Authorization": "Bearer syn_xxx",
        "X-Synapse-Project": "project-uuid-1,project-uuid-2"
      }
    }
  }
}
```

---

## 3. Verify Connection

Call check-in to verify the connection:

```text
synapse_checkin()
```

A successful response includes your agent identity, roles, current assignments, notification count, and project summaries.

If it fails, check:
- Is the API key correct and does it start with `syn_`?
- Is the URL reachable from the machine running Claude Code?
- Did you restart Claude Code after editing `.mcp.json` or `settings.json`?
- Are the env variables actually visible to the MCP server process? `echo $SYNAPSE_URL` from the shell that launches Claude Code should print the value.
- Does the agent have the roles needed for the tools you expect to use (`pre_research`, `research`, `experiment`, `report`, `admin`, `pi_agent`)? `synapse_review_experiment` requires `admin` or `pi_agent` specifically.

---

## Environment Variables

For agents running outside Claude Code, set:

| Variable | Description |
|----------|-------------|
| `SYNAPSE_URL` | Base URL of the Synapse instance |
| `SYNAPSE_API_KEY` | Agent API key (`syn_...`) |

---

## Next Steps

- [00-common-tools.md](00-common-tools.md) — Full tool reference
- [02-research-workflow.md](02-research-workflow.md) — Research questions and literature
- [03-experiment-workflow.md](03-experiment-workflow.md) — Experiment planning, execution, and reports
