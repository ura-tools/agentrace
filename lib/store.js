'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TRACES_DIR = path.join(process.env.AGENTRACE_DIR || path.join(require('os').homedir(), '.agentrace'), 'traces');

function ensureDir() {
  if (!fs.existsSync(TRACES_DIR)) fs.mkdirSync(TRACES_DIR, { recursive: true });
}

function traceFile(traceId) {
  return path.join(TRACES_DIR, `${traceId}.json`);
}

function genId() {
  return crypto.randomBytes(6).toString('hex');
}

function now() {
  return new Date().toISOString();
}

function createTrace(opts = {}) {
  ensureDir();
  const id = genId();
  const trace = {
    id,
    name: opts.name || 'unnamed',
    agent: opts.agent || 'unknown',
    started: now(),
    ended: null,
    status: 'active',
    metadata: opts.metadata || {},
    events: []
  };
  fs.writeFileSync(traceFile(id), JSON.stringify(trace, null, 2));
  return { id, name: trace.name, started: trace.started };
}

function loadTrace(traceId) {
  const f = traceFile(traceId);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function appendEvent(traceId, event) {
  const trace = loadTrace(traceId);
  if (!trace) return { error: `Trace ${traceId} not found` };
  if (trace.status !== 'active') return { error: `Trace ${traceId} is ${trace.status}` };

  event.timestamp = now();
  event.seq = trace.events.length;
  trace.events.push(event);
  fs.writeFileSync(traceFile(traceId), JSON.stringify(trace, null, 2));
  return { seq: event.seq, timestamp: event.timestamp };
}

function addStep(traceId, opts) {
  return appendEvent(traceId, {
    type: 'step',
    action: opts.action || '',
    detail: opts.detail || '',
    tool: opts.tool || null,
    input: opts.input || null,
    output: opts.output || null,
    duration_ms: opts.duration_ms || null
  });
}

function addDecision(traceId, opts) {
  return appendEvent(traceId, {
    type: 'decision',
    question: opts.question || '',
    options: opts.options || [],
    chosen: opts.chosen || '',
    reasoning: opts.reasoning || ''
  });
}

function addError(traceId, opts) {
  return appendEvent(traceId, {
    type: 'error',
    message: opts.message || '',
    code: opts.code || null,
    context: opts.context || '',
    recoverable: opts.recoverable !== false
  });
}

function endTrace(traceId, opts = {}) {
  const trace = loadTrace(traceId);
  if (!trace) return { error: `Trace ${traceId} not found` };

  trace.ended = now();
  trace.status = opts.status || 'completed';
  trace.summary = opts.summary || '';
  trace.result = opts.result || null;
  fs.writeFileSync(traceFile(traceId), JSON.stringify(trace, null, 2));

  const duration = new Date(trace.ended) - new Date(trace.started);
  return {
    id: traceId,
    status: trace.status,
    events: trace.events.length,
    duration_ms: duration
  };
}

function listTraces(limit = 20) {
  ensureDir();
  const files = fs.readdirSync(TRACES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const full = path.join(TRACES_DIR, f);
      return { file: f, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);

  return files.map(f => {
    const trace = JSON.parse(fs.readFileSync(path.join(TRACES_DIR, f.file), 'utf8'));
    return {
      id: trace.id,
      name: trace.name,
      agent: trace.agent,
      status: trace.status,
      started: trace.started,
      ended: trace.ended,
      events: trace.events.length
    };
  });
}

function getTracesDir() {
  return TRACES_DIR;
}

module.exports = {
  createTrace, loadTrace, addStep, addDecision, addError, endTrace, listTraces, getTracesDir
};
