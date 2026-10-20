# Audit environment built from this checkout, not an already published package.
FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5
ENV CI=1 \
    WRANGLER_SEND_METRICS=false \
    NO_UPDATE_NOTIFIER=1 \
    npm_config_audit=false \
    npm_config_fund=false \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH=/opt/oss-scanner-venv/bin:$PATH
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv make git jq ca-certificates build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/oss-scanner-venv \
    && python -m pip install --upgrade pip setuptools wheel
WORKDIR /src
COPY . /src
RUN python -m pip install -e ".[dev,mcp-check,pdf,documents]" black flake8 isort build \
    && npm ci --prefix deploy/cloudflare-worker --no-audit --no-fund \
    && python -m build --wheel --no-isolation
# Pin the official Linux amd64 Foundry archive and prefetch solc while online.
RUN python -c "import urllib.request; urllib.request.urlretrieve('https://github.com/foundry-rs/foundry/releases/download/v1.8.5/foundry_v1.8.5_linux_amd64.tar.gz', '/tmp/foundry.tar.gz')" \
    && echo '6c66ffcc55fa4249197721baa3098bc208014ea1d8aa04b2ed50ac6bccffb226  /tmp/foundry.tar.gz' | sha256sum -c - \
    && tar -xzf /tmp/foundry.tar.gz -C /usr/local/bin forge cast anvil chisel \
    && rm /tmp/foundry.tar.gz \
    && forge build
CMD ["/bin/bash"]
