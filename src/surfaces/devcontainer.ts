/**
 * `devcontainer.json` lifecycle commands. Developers reach for a dev container
 * *because* it isolates a project, so the surprising fact this surface surfaces
 * is that one lifecycle command does not run inside the container at all:
 * `initializeCommand` runs on the host machine, before the container exists.
 * The containers.dev reference is explicit — it is "a command … to run on the
 * host machine during initialization". Every other lifecycle command
 * (`onCreateCommand`, `updateContentCommand`, `postCreateCommand`,
 * `postStartCommand`, `postAttachCommand`) runs inside the container.
 *
 * A lifecycle value may be a string, an argv array, or an object mapping labels
 * to commands that run in parallel; all three shapes are unpacked here.
 */
import { asArray, asObject, parseJsonc } from '../parse/json.js';
import { analyzeCommand } from '../signals/command.js';
import type { Finding, Signal, Surface, Trigger } from '../model.js';
import { gradeSeverity } from '../severity.js';
import { commandString, evidenceOf } from './util.js';

const HOST_COMMAND = 'initializeCommand';
const CONTAINER_COMMANDS = [
  'onCreateCommand',
  'updateContentCommand',
  'postCreateCommand',
  'postStartCommand',
  'postAttachCommand',
] as const;

/** Unpack a lifecycle value into one or more command strings. */
function commandsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  const arr = asArray(value);
  if (arr) {
    const cmd = commandString(arr);
    return cmd ? [cmd] : [];
  }
  const obj = asObject(value);
  if (obj) {
    const out: string[] = [];
    for (const v of Object.values(obj)) {
      const cmd = commandString(v);
      if (cmd) out.push(cmd);
    }
    return out;
  }
  return [];
}

export const devcontainer: Surface = {
  id: 'devcontainer',
  scan(files, read) {
    const findings: Finding[] = [];
    const unreadable: { file: string; reason: string }[] = [];

    // Canonical `.devcontainer/devcontainer.json`, the single-file
    // `.devcontainer.json`, and the multi-config `.devcontainer/<name>/devcontainer.json`.
    const candidates = files.filter(
      (f) => f === '.devcontainer.json' || f.endsWith('/devcontainer.json'),
    );

    for (const file of candidates) {
      const raw = read(file);
      if (raw === null) continue;

      let doc;
      try {
        doc = parseJsonc(raw);
      } catch (e) {
        unreadable.push({ file, reason: (e as Error).message });
        continue;
      }

      const root = asObject(doc.value);
      if (!root) continue;

      const emit = (key: string, boundary: 'host' | 'container', trigger: Trigger) => {
        for (const command of commandsOf(root[key])) {
          const signals: Signal[] = analyzeCommand(command);
          if (boundary === 'host') {
            signals.unshift({
              kind: 'host-escape',
              detail: 'runs on the host machine, outside the container',
            });
          }
          const severity = gradeSeverity(boundary, 'install-step', trigger, signals);
          findings.push({
            surface: this.id,
            title:
              boundary === 'host'
                ? 'Dev container initializeCommand runs on the host'
                : 'Dev container lifecycle command runs in the container',
            trigger,
            boundary,
            gate: 'install-step',
            severity,
            file,
            line: doc.lineContaining(`"${key}"`),
            evidence: evidenceOf(command),
            signals,
            note:
              boundary === 'host'
                ? `${key} runs on your machine when the container is built — it is not sandboxed.`
                : `${key} runs inside the container during setup.`,
          });
        }
      };

      emit(HOST_COMMAND, 'host', 'container-init');
      for (const key of CONTAINER_COMMANDS) emit(key, 'container', 'container-init');
    }

    return { findings, unreadable };
  },
};
