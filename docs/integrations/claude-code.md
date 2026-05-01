# Claude Code Integration

Claude Code (`anthropic.com`) can execute the CLI via a tool specification or `function calling`.

> **Example** (Anthropic function calling):
>
> ```json
> {
>   "name": "agenda_intelligence_run",
>   "arguments": {
>     "command": "source-plan",
>     "category": "technology-ai"
>   }
> }
> ```
>
> The function should return the JSON response and any validation messages.
