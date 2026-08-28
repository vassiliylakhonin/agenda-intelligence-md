# Agenda Intelligence MD — measurement plan

> Status: planning document. The repository contains no verified price,
> customer-volume, revenue, margin, latency-SLA, labour-replacement, or error-rate
> evidence. Do not quote this file as commercial traction or unit economics.

## What can be measured now

The deterministic checker can be benchmarked without an LLM. A dated benchmark
should record:

- commit SHA and deployment surface;
- request and evidence-packet size distribution;
- warm and cold latency percentiles;
- compute duration, memory, storage, and network usage;
- upstream calls and their published prices at the measurement date;
- pass, fail, degraded, and error counts.

These measurements describe one workload and environment. They do not establish
capacity, customer value, correctness, or future infrastructure cost.

## Costs that remain unknown

- Real traffic distribution and peak concurrency.
- Cloudflare plan, storage, log-retention, and egress charges at production scale.
- Optional upstream screening and retrieval costs.
- Model usage if an external workflow chooses to generate repair drafts.
- Support, security review, monitoring, incident response, and compliance work.

The linter itself does not call an LLM. It may produce a repair prompt, but the
caller decides whether and where to send that prompt. Therefore model spend must
not be blended into repository-level economics without observed usage data.

## Commercial hypotheses to test

Pricing should be treated as a research question, not a fact. Useful experiments
include willingness-to-pay interviews, a time-boxed design-partner workflow, and
comparison of reviewer effort before and after using the checker. Record failures
and non-adoption as well as positive signals.

## Minimum evidence for a future unit-economics table

Publish a table only when every value is linked to one of:

1. an invoice or provider usage export;
2. a reproducible benchmark tied to a commit and date;
3. an executed customer agreement or paid invoice; or
4. a clearly labelled scenario with editable assumptions and sensitivity ranges.

Until then, no gross-margin, ROI, staff-replacement, zero-error, or sub-second
production claim is supported.
