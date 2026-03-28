'use strict';

const store = require('./lib/store');
const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL  ${name}: ${e.message}`);
    failed++;
  }
}

// Override dir for tests
process.env.AGENTRACE_DIR = require('path').join(__dirname, '.test-traces');

console.log('\nagentrace tests\n');

let traceId;

test('createTrace returns id', () => {
  const result = store.createTrace({ name: 'test task', agent: 'test-agent', metadata: { repo: 'test' } });
  assert(result.id, 'should have id');
  assert.strictEqual(result.name, 'test task');
  traceId = result.id;
});

test('loadTrace returns created trace', () => {
  const trace = store.loadTrace(traceId);
  assert.strictEqual(trace.name, 'test task');
  assert.strictEqual(trace.agent, 'test-agent');
  assert.strictEqual(trace.status, 'active');
  assert.strictEqual(trace.events.length, 0);
});

test('addStep adds event', () => {
  const result = store.addStep(traceId, { action: 'read file', tool: 'Read', detail: 'config.json' });
  assert.strictEqual(result.seq, 0);
  assert(result.timestamp);
});

test('addDecision adds event', () => {
  const result = store.addDecision(traceId, {
    question: 'Which database?',
    options: ['postgres', 'sqlite', 'mongo'],
    chosen: 'sqlite',
    reasoning: 'Simpler for single-user CLI tool'
  });
  assert.strictEqual(result.seq, 1);
});

test('addError adds event', () => {
  const result = store.addError(traceId, {
    message: 'File not found',
    code: 'ENOENT',
    context: 'reading config'
  });
  assert.strictEqual(result.seq, 2);
});

test('addStep to non-existent trace returns error', () => {
  const result = store.addStep('nonexistent123', { action: 'test' });
  assert(result.error);
});

test('endTrace completes trace', () => {
  const result = store.endTrace(traceId, { summary: 'Test completed', status: 'completed' });
  assert.strictEqual(result.status, 'completed');
  assert.strictEqual(result.events, 3);
  assert(result.duration_ms >= 0);
});

test('addStep to ended trace returns error', () => {
  const result = store.addStep(traceId, { action: 'should fail' });
  assert(result.error);
});

test('listTraces includes our trace', () => {
  const traces = store.listTraces();
  assert(traces.length >= 1);
  const found = traces.find(t => t.id === traceId);
  assert(found);
  assert.strictEqual(found.status, 'completed');
});

// Cleanup
const fs = require('fs');
const path = require('path');
const testDir = path.join(__dirname, '.test-traces', 'traces');
if (fs.existsSync(testDir)) {
  for (const f of fs.readdirSync(testDir)) fs.unlinkSync(path.join(testDir, f));
  fs.rmdirSync(testDir);
  fs.rmdirSync(path.join(__dirname, '.test-traces'));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
