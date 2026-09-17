# CrewAI Autonomous B2B Deal & Escrow Arbitration Tool

Equip CrewAI agents with `M2MEscrowArbiter` to resolve delivery quality disputes and calculate settlements autonomously.

## Usage in CrewAI

```python
from crewai import Agent, Task, Crew
from examples.crewai_b2b_deal.run import EscrowArbitrationTool

arbitration_tool = EscrowArbitrationTool()

dispute_officer = Agent(
    role="Deal Dispute Officer",
    goal="Ensure deliverable contracts meet agreed specifications and calculate fair settlement",
    tools=[arbitration_tool],
    verbose=True
)
```

## Running the Example

```bash
python3 run.py
```
