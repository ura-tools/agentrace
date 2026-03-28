# agentrace

Structured observability for AI agents. See what your agent does, why it decides, and where it fails.

MCP server + CLI viewer. Zero dependencies. Works with Claude Code, Cursor, or any MCP client.

## Install

```bash
npm install -g @ura-dev/agentrace
```

## MCP Setup

Add to your AI tool config:

```json
{
  "mcpServers": {
    "agentrace": { "command": "agentrace-mcp" }
  }
}
```

Your AI agent now has access to structured tracing tools.

## MCP Tools

| Tool | Description |
|------|-------------|
| `trace_start` | Start a new trace session |
| `trace_step` | Log a step (action, tool used, input/output) |
| `trace_decision` | Log a decision point (options, chosen, reasoning) |
| `trace_error` | Log an error or unexpected state |
| `trace_end` | End a trace session |
| `trace_list` | List recent traces |
| `trace_view` | View a complete trace |

## CLI

```bash
agentrace list              # Recent traces
agentrace view <trace-id>   # Full trace with events
agentrace watch <trace-id>  # Real-time tail
agentrace stats             # Trace statistics
```

## How it works

When an AI agent starts a complex task, it calls `trace_start`. As it works, it logs each step (`trace_step`), records decision points (`trace_decision`), and captures errors (`trace_error`). When done, it calls `trace_end`.

Traces are stored as JSON files in `~/.agentrace/traces/`. You can view them with the CLI, or read them directly.

## As a library

```javascript
const { createTrace, addStep, addDecision, endTrace } = require('@ura-dev/agentrace');

const { id } = createTrace({ name: 'deploy pipeline', agent: 'my-agent' });
addStep(id, { action: 'build', tool: 'npm', output: 'success' });
addDecision(id, { question: 'Deploy target?', chosen: 'staging', reasoning: 'Friday deploy' });
endTrace(id, { status: 'completed', summary: 'Deployed to staging' });
```

## Config

| Env var | Description |
|---------|-------------|
| `AGENTRACE_DIR` | Override storage directory (default: `~/.agentrace`) |

## License

MIT — [ura](https://github.com/ura-tools)
