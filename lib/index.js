'use strict';

const store = require('./store');

module.exports = {
  createTrace: store.createTrace,
  loadTrace: store.loadTrace,
  addStep: store.addStep,
  addDecision: store.addDecision,
  addError: store.addError,
  endTrace: store.endTrace,
  listTraces: store.listTraces
};
