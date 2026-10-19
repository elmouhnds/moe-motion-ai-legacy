'use strict';
/**
 * Permission model.
 *
 * Permission scopes a tool may declare:
 *   read                 read-only host access
 *   modify.keyframes     change keyframe timing/ease/values
 *   modify.layers        change layer timing/properties
 *   modify.expressions   set or clear expressions
 *   modify.effects       add effects or change effect parameters
 *   network.ai           send project context to the Claude API
 *
 * Origins: 'user' (a direct click in the panel), 'agent' (a step in an AI plan),
 * 'recipe' (a saved recipe run).
 *
 * Decisions: 'allow' | 'confirm' | 'deny'.
 * Hard rules that settings cannot weaken:
 *   - an 'agent' origin can never modify the project without confirmation;
 *   - a scope set to 'deny' blocks every origin.
 */

const SCOPES = ['read', 'modify.keyframes', 'modify.layers', 'modify.expressions', 'modify.effects', 'network.ai'];

const DEFAULT_POLICY = {
  read: 'allow',
  'modify.keyframes': 'allow',
  'modify.layers': 'allow',
  'modify.expressions': 'allow',
  'modify.effects': 'allow',
  'network.ai': 'allow'
};

function decide(tool, origin, policy) {
  const p = Object.assign({}, DEFAULT_POLICY, policy || {});
  let decision = 'allow';
  const reasons = [];
  for (const scope of tool.permissions || []) {
    if (!SCOPES.includes(scope)) return { decision: 'deny', reasons: [`Unknown permission scope "${scope}"`] };
    const setting = p[scope] || 'confirm';
    if (setting === 'deny') return { decision: 'deny', reasons: [`"${scope}" is disabled in Settings`] };
    if (setting === 'confirm' && decision === 'allow') { decision = 'confirm'; reasons.push(`"${scope}" requires confirmation`); }
    if (scope.startsWith('modify.') && origin === 'agent' && decision === 'allow') {
      decision = 'confirm';
      reasons.push('AI-planned changes always need approval');
    }
  }
  if (tool.destructive && decision === 'allow' && origin !== 'user') {
    decision = 'confirm';
    reasons.push('Destructive operation');
  }
  return { decision, reasons };
}

module.exports = { SCOPES, DEFAULT_POLICY, decide };
