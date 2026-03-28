#!/usr/bin/env node
'use strict';

const { viewTrace, listTraces, watchTrace, stats } = require('../lib/viewer');

const args = process.argv.slice(2);
const cmd = args[0];

const HELP = `
agentrace — structured observability for AI agents

Usage:
  agentrace list [--limit N]     List recent traces
  agentrace view <trace-id>      View a complete trace
  agentrace watch <trace-id>     Real-time tail of active trace
  agentrace stats                Show trace statistics

MCP Server:
  agentrace-mcp                  Start MCP server (stdio)

Config:
  AGENTRACE_DIR                  Override storage dir (default: ~/.agentrace)

Add to your AI tool config:
  { "mcpServers": { "agentrace": { "command": "agentrace-mcp" } } }

Tools exposed via MCP:
  trace_start     Start a new trace session
  trace_step      Log a step (action, tool, input/output)
  trace_decision  Log a decision point (options, chosen, reasoning)
  trace_error     Log an error
  trace_end       End a trace session
  trace_list      List recent traces
  trace_view      View a complete trace
`;

if (!cmd || cmd === '--help' || cmd === '-h') {
  console.log(HELP);
  process.exit(0);
}

switch (cmd) {
  case 'list': {
    const limitIdx = args.indexOf('--limit');
    const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 20;
    listTraces(limit);
    break;
  }
  case 'view': {
    const id = args[1];
    if (!id) { console.error('Usage: agentrace view <trace-id>'); process.exit(1); }
    viewTrace(id);
    break;
  }
  case 'watch': {
    const id = args[1];
    if (!id) { console.error('Usage: agentrace watch <trace-id>'); process.exit(1); }
    watchTrace(id);
    break;
  }
  case 'stats':
    stats();
    break;
  default:
    // Try as trace-id
    if (/^[0-9a-f]{12}$/.test(cmd)) {
      viewTrace(cmd);
    } else {
      console.error(`Unknown command: ${cmd}`);
      console.log(HELP);
      process.exit(1);
    }
}
