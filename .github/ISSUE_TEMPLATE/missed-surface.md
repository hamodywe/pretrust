---
name: Missed execution surface
about: A config file that runs code on open/install/git/agent that pretrust does not cover
title: 'surface: <file> runs code on <trigger>'
labels: surface
---

**The file**
Which file, and where it lives in a repo (e.g. `.idea/workspace.xml`).

**The trigger — with a citation**
When does it run (folder open, install, a git action, an agent session), and what
documentation says so? A link to the official docs or an advisory is what lets us
model this as a fact rather than a guess.

**The command/key that executes**
The specific key or value that carries the executable content.

**Where control lands**
Host machine, a container, or an agent's tool loop?

**A minimal example**
The smallest file contents that would trigger it.
