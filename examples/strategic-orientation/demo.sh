#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
printf '%s\n' 'LOCAL ORIENTATION AND SPECIALIZED GATE'
node examples/strategic-orientation/orientation-demo.mjs
printf '\n%s\n' 'BEFORE: missing references (fictional example)'
agenda-intelligence review-answer examples/strategic-orientation/before.json
printf '\n%s\n' 'AFTER: referenced fictional text supplied; human review still required'
agenda-intelligence review-answer examples/strategic-orientation/after.json --strict
