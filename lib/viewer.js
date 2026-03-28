'use strict';

const store = require('./store');

// ANSI colors
const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

function statusColor(status) {
  if (status === 'completed') return C.green;
  if (status === 'failed') return C.red;
  if (status === 'active') return C.cyan;
  if (status === 'cancelled') return C.yellow;
  return C.white;
}

function typeIcon(type) {
  if (type === 'step') return `${C.blue}>>${C.reset}`;
  if (type === 'decision') return `${C.magenta}??${C.reset}`;
  if (type === 'error') return `${C.red}!!${C.reset}`;
  return `${C.gray}--${C.reset}`;
}

function formatDuration(ms) {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function viewTrace(traceId) {
  const trace = store.loadTrace(traceId);
  if (!trace) {
    console.error(`Trace ${traceId} not found`);
    process.exit(1);
  }

  const sc = statusColor(trace.status);
  const duration = trace.ended ? new Date(trace.ended) - new Date(trace.started) : Date.now() - new Date(trace.started);

  console.log();
  console.log(`${C.bold}${trace.name}${C.reset} ${C.dim}[${trace.id}]${C.reset}`);
  console.log(`${C.gray}agent: ${trace.agent} | status: ${sc}${trace.status}${C.reset}${C.gray} | ${formatDuration(duration)} | ${trace.events.length} events${C.reset}`);
  console.log(`${C.gray}started: ${trace.started}${trace.ended ? ` | ended: ${trace.ended}` : ''}${C.reset}`);

  if (trace.metadata && Object.keys(trace.metadata).length) {
    console.log(`${C.gray}metadata: ${JSON.stringify(trace.metadata)}${C.reset}`);
  }

  if (trace.summary) {
    console.log(`${C.gray}summary: ${trace.summary}${C.reset}`);
  }

  console.log(`${C.dim}${'─'.repeat(60)}${C.reset}`);

  for (const ev of trace.events) {
    const time = formatTime(ev.timestamp);
    const icon = typeIcon(ev.type);

    if (ev.type === 'step') {
      const tool = ev.tool ? `${C.dim}[${ev.tool}]${C.reset} ` : '';
      const dur = ev.duration_ms ? ` ${C.dim}(${formatDuration(ev.duration_ms)})${C.reset}` : '';
      console.log(`${C.gray}${time}${C.reset} ${icon} ${tool}${C.bold}${ev.action}${C.reset}${dur}`);
      if (ev.detail) console.log(`       ${C.dim}${ev.detail}${C.reset}`);
      if (ev.input) console.log(`       ${C.dim}in: ${truncate(ev.input, 80)}${C.reset}`);
      if (ev.output) console.log(`       ${C.dim}out: ${truncate(ev.output, 80)}${C.reset}`);
    }

    else if (ev.type === 'decision') {
      console.log(`${C.gray}${time}${C.reset} ${icon} ${C.magenta}${ev.question}${C.reset}`);
      if (ev.options && ev.options.length) {
        for (const opt of ev.options) {
          const marker = opt === ev.chosen ? `${C.green}*` : ` `;
          console.log(`       ${marker} ${opt}${C.reset}`);
        }
      }
      if (ev.reasoning) console.log(`       ${C.dim}reason: ${ev.reasoning}${C.reset}`);
    }

    else if (ev.type === 'error') {
      const code = ev.code ? ` [${ev.code}]` : '';
      const rec = ev.recoverable ? '' : ` ${C.red}(fatal)${C.reset}`;
      console.log(`${C.gray}${time}${C.reset} ${icon} ${C.red}${ev.message}${code}${C.reset}${rec}`);
      if (ev.context) console.log(`       ${C.dim}context: ${ev.context}${C.reset}`);
    }
  }

  if (trace.result) {
    console.log(`${C.dim}${'─'.repeat(60)}${C.reset}`);
    console.log(`${C.bold}Result:${C.reset} ${trace.result}`);
  }

  console.log();
}

function listTraces(limit) {
  const traces = store.listTraces(limit);

  if (!traces.length) {
    console.log(`${C.dim}No traces found. Start one with: trace_start via MCP${C.reset}`);
    return;
  }

  console.log();
  console.log(`${C.bold}Recent traces${C.reset} ${C.dim}(${traces.length})${C.reset}`);
  console.log(`${C.dim}${'─'.repeat(70)}${C.reset}`);

  for (const t of traces) {
    const sc = statusColor(t.status);
    const dur = t.ended ? formatDuration(new Date(t.ended) - new Date(t.started)) : 'running';
    console.log(
      `${C.dim}${t.id}${C.reset} ${sc}${pad(t.status, 10)}${C.reset} ` +
      `${C.bold}${pad(t.name, 30)}${C.reset} ` +
      `${C.dim}${t.agent} | ${t.events} events | ${dur}${C.reset}`
    );
  }
  console.log();
}

function watchTrace(traceId) {
  console.log(`${C.dim}Watching trace ${traceId}... (Ctrl+C to stop)${C.reset}`);
  let lastLen = 0;

  const interval = setInterval(() => {
    const trace = store.loadTrace(traceId);
    if (!trace) {
      console.error(`Trace ${traceId} not found`);
      clearInterval(interval);
      process.exit(1);
    }

    const newEvents = trace.events.slice(lastLen);
    for (const ev of newEvents) {
      const time = formatTime(ev.timestamp);
      const icon = typeIcon(ev.type);

      if (ev.type === 'step') {
        const tool = ev.tool ? `[${ev.tool}] ` : '';
        console.log(`${C.gray}${time}${C.reset} ${icon} ${tool}${ev.action}`);
      } else if (ev.type === 'decision') {
        console.log(`${C.gray}${time}${C.reset} ${icon} ${C.magenta}${ev.question}${C.reset} → ${ev.chosen}`);
      } else if (ev.type === 'error') {
        console.log(`${C.gray}${time}${C.reset} ${icon} ${C.red}${ev.message}${C.reset}`);
      }
    }
    lastLen = trace.events.length;

    if (trace.status !== 'active') {
      console.log(`${C.dim}Trace ${trace.status}. ${trace.events.length} events total.${C.reset}`);
      clearInterval(interval);
    }
  }, 500);
}

function stats() {
  const traces = store.listTraces(1000);
  const active = traces.filter(t => t.status === 'active').length;
  const completed = traces.filter(t => t.status === 'completed').length;
  const failed = traces.filter(t => t.status === 'failed').length;
  const totalEvents = traces.reduce((s, t) => s + t.events, 0);

  console.log();
  console.log(`${C.bold}agentrace stats${C.reset}`);
  console.log(`${C.dim}${'─'.repeat(30)}${C.reset}`);
  console.log(`Total traces:   ${traces.length}`);
  console.log(`Active:         ${C.cyan}${active}${C.reset}`);
  console.log(`Completed:      ${C.green}${completed}${C.reset}`);
  console.log(`Failed:         ${C.red}${failed}${C.reset}`);
  console.log(`Total events:   ${totalEvents}`);
  console.log(`Storage:        ${store.getTracesDir()}`);
  console.log();
}

function truncate(s, max) {
  if (!s) return '';
  return s.length > max ? s.substring(0, max - 3) + '...' : s;
}

function pad(s, len) {
  if (!s) return ' '.repeat(len);
  return s.length >= len ? s.substring(0, len) : s + ' '.repeat(len - s.length);
}

module.exports = { viewTrace, listTraces, watchTrace, stats };
