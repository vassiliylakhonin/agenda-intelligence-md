#!/bin/sh
# Run inside the built image with Docker --network none. No credentials required.
set -eu
cd /src
make verify-local
python -m build --wheel --no-isolation
forge test --offline -v
