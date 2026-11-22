# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/fatarichi/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/fatarichi/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0, entered in
[Read broken CSV files faster, 21 November 2026](https://make.fun/bounty/csv-reader-speed-01-run-20261121).

It answers exactly as csv-reader 1.0.0 does on every case — the same
`{columns, rows, errors}` for every `{text, header}` — but faster.

## What it does

csv-reader 1.0.0 reads one character at a time and builds every field a
character at a time. This version instead takes each field with `slice()`
(one string per field, not one per character), finds a quoted field's
closing quote with `indexOf()`, and only falls back to a character scan
for the rare broken bits: a stray CR, a quote that never closes, the
characters after a closing quote, and line breaks inside quotes.

On the practice set it reads all six cases about 3–4× faster than
csv-reader 1.0.0 (CPU time), with identical answers on every case.

## How it runs

```sh
node main.ts
```

`main.ts` reads every case from `/input/cases.json` (or
`$MAKEFUN_INPUT_DIR/cases.json`), answers each one alone with `run()` from
`solve.js`, and writes `/output/answers.json` (or
`$MAKEFUN_OUTPUT_DIR/answers.json`).

`solve.js` is a dependency-free ES module. `run(input)` returns
csv-reader 1.0.0's answer for one case's input. Pure: no clock, no
randomness, no locale, nothing kept from one case to the next.

## Files

- `solve.js` — the fast reader (`run(input)`).
- `main.ts` — the program the harness runs.
- `LICENSE` — MIT.

Built for [make.fun](https://make.fun).
