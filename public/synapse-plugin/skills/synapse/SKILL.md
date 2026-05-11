---
name: synapse
description: Synapse platform overview and router skill. Use it to orient on projects and then hand off to the stage-specific Synapse skills.
license: AGPL-3.0
metadata:
  author: Vincentwei1021
  version: "0.6.1"
  category: research
  mcp_server: synapse
---

# Synapse Skill

Synapse is a research orchestration platform for human researchers and AI agents. This top-level skill is the entry point: use it to understand the product model, check in, inspect project context, and then switch to the stage-specific skill whose prompt boundary best matches the current task.

## Stage Skills

| Skill | When to use it |
|------|-----------------|
| **[setup](../setup/SKILL.md)** | Configure MCP, API keys, and project-level `.mcp.json` |
| **[research](../research/SKILL.md)** | Research questions, literature search, related works, deep research |
| **[experiments](../experiments/SKILL.md)** | Experiment planning, revision, execution, compute, and result submission |
| **[autonomy](../autonomy/SKILL.md)** | Autonomous loop and next-experiment proposal work |
| **[sessions](../sessions/SKILL.md)** | Session lifecycle, observability, and sub-agent behavior |
| **[agent-teams](../agent-teams/SKILL.md)** | Claude Code Agent Teams orchestration with Synapse |

## Core Workflow

```text
ResearchProject --> ResearchQuestion --> Experiment --> Report
       ^                  ^                  ^            ^
     Human           Human/Agent        Agent executes  Agent writes
    creates          formulates         and reports     synthesis
```

Tool families are exposed according to the agent's Synapse roles. Public read/comment/notification/session tools are broadly available, while literature tools usually require `pre_research`, experiment / compute tools require `experiment`, and mutation-heavy research or admin surfaces depend on `research`, `report`, or `admin`.

## Getting Started

### Step 1: Setup and check in

Configure your MCP connection with **[setup](../setup/SKILL.md)**, then call:

```text
synapse_checkin()
```

Returns your agent identity, current assignments, and pending work.

### Step 2: Handle active plugin context

The Synapse Claude Code plugin may inject active context during session start, user prompts, sub-agent starts, and task completion. Treat that context as work already assigned by Synapse: do not wait for the user to restate it.

When hook context mentions an active project, assignment, experiment, synthesis task, deep research task, notification, or sub-agent session:

1. Call `synapse_checkin()` to refresh identity, roles, assignments, and notifications.
2. Use the UUIDs from the hook context with the matching `synapse_get_*` tool.
3. Continue through the matching stage skill below.
4. Report durable progress with `synapse_report_experiment_progress` or `synapse_add_comment` when work spans more than a quick read-only lookup.
5. Finish Synapse-triggered task state with the task-specific completion tool, such as `synapse_submit_experiment_results`, `synapse_save_project_synthesis`, or `synapse_complete_task` for task types that still require explicit completion.

For OpenClaw realtime agents, the plugin also routes Synapse notifications from SSE into context-rich prompts. Handle those routed prompts before starting unrelated work.

### Step 3: Choose the right stage skill

| Current work | Skill to use |
|--------------|---------------|
| Understanding project context and project state | Stay here, then call `synapse_get_project_full_context()` |
| Research questions, literature, deep research | **[research](../research/SKILL.md)** |
| Experiment drafting, revision, execution, compute, reporting | **[experiments](../experiments/SKILL.md)** |
| Autonomous next-step proposal and queue-empty behavior | **[autonomy](../autonomy/SKILL.md)** |
| Session tracking and observability concerns | **[sessions](../sessions/SKILL.md)** |
| Multi-agent parallel dispatch in Claude Code | **[agent-teams](../agent-teams/SKILL.md)** |

## Active Trigger Routing

| Trigger or hook context | First action | Then use |
|-------------------------|--------------|----------|
| Experiment assignment or assigned experiment UUID | `synapse_get_experiment({ experimentUuid })` | **[experiments](../experiments/SKILL.md)** to start, run, report progress, and submit results |
| Experiment plan requested | `synapse_get_experiment()` plus `synapse_get_project_full_context()` | **[experiments](../experiments/SKILL.md)** to update the plan |
| Experiment revision requested | `synapse_get_experiment()` and read relevant comments if needed | **[experiments](../experiments/SKILL.md)** to revise and resubmit/update |
| Experiment report requested | `synapse_get_experiment()` and inspect completed results | **[experiments](../experiments/SKILL.md)** to write the report/result document |
| Research question claimed | `synapse_get_research_question()` and `synapse_get_project_full_context()` | **[research](../research/SKILL.md)** |
| Deep research requested | `synapse_get_project_full_context()`, `synapse_get_related_works()`, then existing report via `synapse_get_deep_research_report()` | **[research](../research/SKILL.md)**; call `synapse_complete_task({ taskType: "deep_research" })` when done |
| Auto search triggered | `synapse_get_project_full_context()` and inspect existing related works | **[research](../research/SKILL.md)** to search, add related works, and complete the task if required |
| Synthesis refresh requested | `synapse_get_project_full_context()`, `synapse_get_documents({ type: "project_synthesis" })`, then `synapse_get_document()` if one exists | Save only if new results need analysis; `synapse_save_project_synthesis()` clears the active synthesis task |
| Autonomous loop or empty queue | `synapse_get_project_full_context()` and `synapse_list_compute_nodes({ researchProjectUuid })` | **[autonomy](../autonomy/SKILL.md)** to propose next experiments |
| @mention or comment notification | `synapse_get_comments()` for the target when available | Reply with `synapse_add_comment()` |
| Sub-agent start/session context | Use the injected experiment UUID, then `synapse_get_experiment()` | **[sessions](../sessions/SKILL.md)** for lifecycle behavior and **[experiments](../experiments/SKILL.md)** for work execution |

## Minimum Tool Map

| Need | Tools |
|------|-------|
| Identity, assignments, notifications | `synapse_checkin`, `synapse_get_notifications`, `synapse_mark_notification_read` |
| Project context | `synapse_get_research_project`, `synapse_get_project_full_context` |
| Documents and synthesis | `synapse_get_documents`, `synapse_get_document`, `synapse_save_project_synthesis` |
| Literature and deep research | `synapse_search_papers`, `synapse_add_related_work`, `synapse_get_related_works`, `synapse_get_deep_research_report` |
| Research questions | `synapse_get_research_question` and research-question mutation tools when roles allow |
| Experiments | `synapse_get_assigned_experiments`, `synapse_get_experiment`, `synapse_start_experiment`, `synapse_report_experiment_progress`, `synapse_submit_experiment_results`, `synapse_propose_experiment` |
| Compute | `synapse_list_compute_nodes`, `synapse_reserve_gpus`, `synapse_get_node_access_bundle` |
| Collaboration | `synapse_add_comment`, `synapse_get_comments`, `synapse_search_mentionables` |
| Task cleanup | `synapse_complete_task` except where a task-specific save/submit tool already clears state |

## Execution Rules

1. **Always check in first** -- call `synapse_checkin()` at session start.
2. **Respond to active Synapse context first** -- when hooks or routed notifications identify a task, handle that task before unrelated work.
3. **Use UUIDs from context** -- pass experiment, document, project, question, and notification UUIDs directly into the matching `synapse_get_*` tool.
4. **Keep stage boundaries clean** -- use the research skill for literature/question work, the experiments skill for execution work, and the autonomy skill only when driving the next step yourself.
5. **Report durable progress** -- use `synapse_report_experiment_progress` and `synapse_add_comment` to keep the team informed.
6. **Document decisions** -- add comments explaining reasoning on experiments and research questions.
7. **Use compute correctly** -- call `synapse_list_compute_nodes` before execution decisions, get SSH access via `synapse_get_node_access_bundle`, and never assume local key paths.
8. **Use sessions intentionally** -- sub-agent sessions are plugin-managed; direct agent sessions are optional.

## Shared References

- **[references/00-common-tools.md](references/00-common-tools.md)** -- full tool inventory by category
- **[references/01-setup.md](references/01-setup.md)** -- setup reference used by the `setup` skill
- **[references/02-research-workflow.md](references/02-research-workflow.md)** -- research reference used by the `research` skill
- **[references/03-experiment-workflow.md](references/03-experiment-workflow.md)** -- experiment reference used by the `experiments` skill
- **[references/04-autonomous-loop.md](references/04-autonomous-loop.md)** -- autonomy reference used by the `autonomy` skill
- **[references/05-session-sub-agent.md](references/05-session-sub-agent.md)** -- sessions reference used by the `sessions` skill
- **[references/06-claude-code-agent-teams.md](references/06-claude-code-agent-teams.md)** -- agent teams reference used by the `agent-teams` skill

## Status Lifecycles

### Experiment Status Flow
```text
draft --> pending_review --> pending_start --> in_progress --> completed
```

### Research Question Status Flow
```text
open --> elaborating --> proposal_created --> completed
  \                                            /
   \--> closed <------------------------------/
```
