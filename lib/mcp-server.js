'use strict';

const store = require('./store');

// MCP stdio JSON-RPC server
const TOOLS = [
  {
    name: 'trace_start',
    description: 'Start a new trace session. Call this at the beginning of a complex task to track what the agent does, why, and what happens.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the task being traced (e.g. "refactor auth module")' },
        agent: { type: 'string', description: 'Agent identifier (e.g. "claude-code", "cursor", "custom-agent")' },
        metadata: { type: 'object', description: 'Optional key-value metadata (e.g. { repo: "myapp", branch: "main" })' }
      },
      required: ['name']
    }
  },
  {
    name: 'trace_step',
    description: 'Log a step in the current trace. Use this for each meaningful action: tool call, file read, code change, API call, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        trace_id: { type: 'string', description: 'The trace ID returned by trace_start' },
        action: { type: 'string', description: 'What was done (e.g. "read file", "edit function", "run tests")' },
        detail: { type: 'string', description: 'Details about the action' },
        tool: { type: 'string', description: 'Tool used (e.g. "Read", "Edit", "Bash")' },
        input: { type: 'string', description: 'Summarized input to the tool/action' },
        output: { type: 'string', description: 'Summarized output/result' },
        duration_ms: { type: 'number', description: 'How long the step took in milliseconds' }
      },
      required: ['trace_id', 'action']
    }
  },
  {
    name: 'trace_decision',
    description: 'Log a decision point. Use this when the agent chooses between alternatives — captures the reasoning behind the choice.',
    inputSchema: {
      type: 'object',
      properties: {
        trace_id: { type: 'string', description: 'The trace ID' },
        question: { type: 'string', description: 'What decision was needed (e.g. "Which approach for error handling?")' },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Options considered'
        },
        chosen: { type: 'string', description: 'Which option was chosen' },
        reasoning: { type: 'string', description: 'Why this option was chosen' }
      },
      required: ['trace_id', 'question', 'chosen']
    }
  },
  {
    name: 'trace_error',
    description: 'Log an error or unexpected state encountered during execution.',
    inputSchema: {
      type: 'object',
      properties: {
        trace_id: { type: 'string', description: 'The trace ID' },
        message: { type: 'string', description: 'Error message or description' },
        code: { type: 'string', description: 'Error code if available' },
        context: { type: 'string', description: 'What was happening when the error occurred' },
        recoverable: { type: 'boolean', description: 'Whether the agent can recover from this error (default: true)' }
      },
      required: ['trace_id', 'message']
    }
  },
  {
    name: 'trace_end',
    description: 'End a trace session. Call this when the task is complete (successfully or not).',
    inputSchema: {
      type: 'object',
      properties: {
        trace_id: { type: 'string', description: 'The trace ID' },
        status: { type: 'string', enum: ['completed', 'failed', 'cancelled'], description: 'Final status (default: completed)' },
        summary: { type: 'string', description: 'Brief summary of what was accomplished' },
        result: { type: 'string', description: 'Final result or output' }
      },
      required: ['trace_id']
    }
  },
  {
    name: 'trace_list',
    description: 'List recent traces. Useful for reviewing past agent sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max traces to return (default: 20)' }
      }
    }
  },
  {
    name: 'trace_view',
    description: 'View a complete trace with all its events.',
    inputSchema: {
      type: 'object',
      properties: {
        trace_id: { type: 'string', description: 'The trace ID to view' }
      },
      required: ['trace_id']
    }
  }
];

function handleToolCall(name, args) {
  switch (name) {
    case 'trace_start':
      return store.createTrace(args);
    case 'trace_step':
      return store.addStep(args.trace_id, args);
    case 'trace_decision':
      return store.addDecision(args.trace_id, args);
    case 'trace_error':
      return store.addError(args.trace_id, args);
    case 'trace_end':
      return store.endTrace(args.trace_id, args);
    case 'trace_list':
      return store.listTraces(args.limit);
    case 'trace_view': {
      const trace = store.loadTrace(args.trace_id);
      if (!trace) return { error: `Trace ${args.trace_id} not found` };
      return trace;
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// JSON-RPC stdio transport
let buffer = '';

function sendResponse(id, result) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`);
}

function sendError(id, code, message) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`);
}

function sendNotification(method, params) {
  const msg = JSON.stringify({ jsonrpc: '2.0', method, params });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`);
}

function handleMessage(raw) {
  let req;
  try { req = JSON.parse(raw); } catch { return; }

  const { id, method, params } = req;

  switch (method) {
    case 'initialize':
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'agentrace', version: '1.0.0' }
      });
      break;

    case 'notifications/initialized':
      // Client acknowledged — no response needed
      break;

    case 'tools/list':
      sendResponse(id, { tools: TOOLS });
      break;

    case 'tools/call': {
      const { name, arguments: args } = params || {};
      try {
        const result = handleToolCall(name, args || {});
        const hasError = result && result.error;
        sendResponse(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !!hasError
        });
      } catch (e) {
        sendResponse(id, {
          content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }],
          isError: true
        });
      }
      break;
    }

    case 'ping':
      sendResponse(id, {});
      break;

    default:
      if (id) sendError(id, -32601, `Method not found: ${method}`);
  }
}

function parseMessages() {
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;

    const header = buffer.substring(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) { buffer = buffer.substring(headerEnd + 4); continue; }

    const len = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + len) break;

    const body = buffer.substring(bodyStart, bodyStart + len);
    buffer = buffer.substring(bodyStart + len);
    handleMessage(body);
  }
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { buffer += chunk; parseMessages(); });
process.stdin.on('end', () => process.exit(0));

process.stderr.write('agentrace MCP server running on stdio\n');
