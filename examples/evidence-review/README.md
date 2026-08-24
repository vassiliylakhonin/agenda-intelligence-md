# Local evidence review example

This example keeps two Russian claims in a small manifest and loads their source
text from adjacent UTF-8 and Markdown files.

Run:

```bash
agenda-intelligence review examples/evidence-review/manifest.json --out review.md --strict
```

Expected packet status: `packet_complete`.

The result proves that the local file adapter and Unicode tokenization handle
this fixture. It does not establish factual truth, broader language quality, or
customer value. Human review remains required.
