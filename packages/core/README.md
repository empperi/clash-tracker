# @clash-tracker/core

Pure, side-effect-free domain logic shared by `functions/` and `web/`.

Everything here is a **pure function** over plain data — no Firebase, no network, no
clocks read directly (time is passed in). That makes the rules that matter most — who
qualifies for CWL, how players are ordered, how the war plan is built — fully unit
testable with zero infrastructure.

> Scaffolded by Track 1; populated by Track 4 (ranking/stats) and Track 9 (war planning).
