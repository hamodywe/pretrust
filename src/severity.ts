/**
 * Turning a classified path into a severity.
 *
 * The rule is deliberately blunt and legible, because a severity a user cannot
 * predict is a severity they learn to ignore:
 *
 *   - A path carrying a strong risk signal is `high` — unless it is walled
 *     inside a dev container, where the same signal is `medium`.
 *   - A path with no strong signal is inventory. How prominent it is depends on
 *     how little friction stands between cloning and running, and on whether it
 *     fires the moment the repo is opened rather than on a later deliberate act.
 *
 * The load-bearing guarantee, tested against a fixture of ordinary husky hooks
 * and native-addon `postinstall` steps, is that an honest repository produces a
 * map and *no* `high` findings.
 */
import type { Boundary, Gate, Severity, Signal, Trigger } from './model.js';
import { hasNotableSignal, hasStrongSignal } from './signals/command.js';

export function gradeSeverity(
  boundary: Boundary,
  _gate: Gate,
  trigger: Trigger,
  signals: readonly Signal[],
): Severity {
  if (hasStrongSignal(signals)) return boundary === 'container' ? 'medium' : 'high';
  if (hasNotableSignal(signals)) return boundary === 'container' ? 'low' : 'medium';

  const weakOnly = signals.length > 0; // e.g. an os-branch with nothing stronger
  const firesOnOpen = trigger === 'folder-open' || trigger === 'agent-session';

  if (boundary === 'container') return 'low';
  if (firesOnOpen) return weakOnly ? 'medium' : 'low';
  return weakOnly ? 'low' : 'info';
}
