# Geography routing

How `analyze` decides which regional and sector modules to load.

This file and `llms.txt` are the two canon mirrors of the routing term sets. The guard `test_routing_terms_documented_in_canon` in [`tests/test_product_shell.py`](../tests/test_product_shell.py) fails if a term exists in code but not in both. Keep the terms lowercased and verbatim.

`analyze` matches lowercased question/decision_context/geography text against fixed term sets in [src/agenda_intelligence/product.py](../src/agenda_intelligence/product.py). Modules union, not exclusive: a query can pull GTTA + multiple regional modules. `result.modules_used` records what loaded.

**global-think-tank-analyst** — always loaded as the core reasoning method.

**central-asia-caspian** (`CA_CASPIAN_TERMS`):

```
almaty, azerbaijan, baku, caspian, central asia, georgia,
kazakhstan, kyrgyzstan, middle corridor, tajikistan, tashkent,
tcita, tcitr, turkmenistan, uzbekistan
```

**gulf-middle-east** (`GULF_ME_TERMS`):

```
arabian gulf, bab el mandeb, bab-el-mandeb, bahrain, gcc, gulf,
hormuz, iran, iraq, ksa, kuwait, levant, middle east, oman,
persian gulf, qatar, red sea, saudi arabia, strait of hormuz,
uae, united arab emirates, yemen
```

**eu** (`EU_TERMS`; plus exact-token geography match against `EU`/`Europe`):

```
brussels, cbam, cjeu, ecb, eu ai act, eu enforcement, eu regulation,
european central bank, european commission, european council,
european parliament, european union, gdpr, nis2, schrems
```

**sanctions** (`SANCTIONS_TERMS`, sector module):

```
entity list, export control, export controls, ofac, sanctions,
secondary sanctions
```

When extending the term sets, keep them lowercased and update this block plus the matching block in `llms.txt`. The guard in [tests/test_product_shell.py](../tests/test_product_shell.py) (`test_routing_terms_documented_in_canon`) fails if a term exists in code but not in both canon docs.
