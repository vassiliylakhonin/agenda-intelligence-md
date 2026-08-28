# Sanctions Sector Lens

## Purpose

Use this lens when an agenda item involves sanctions, export controls, asset freezes, designations, delistings, secondary sanctions, enforcement, beneficial ownership, trade routing, financial restrictions, or compliance exposure.

This is not legal advice or a compliance determination. It is a portable reasoning layer for AI agents analyzing sanctions-related public agenda.

Default question:

> What does this development change for prohibited activity, enforcement risk, counterparty exposure, routing behavior, financial access, documentation burden, and decision timing?

## Required sanctions checks

Always check whether the development affects:

1. Who is restricted: person, entity, vessel, bank, sector, geography, product, service, technology, ownership network
2. What is restricted: dealing, financing, export, import, transit, insurance, brokering, technology transfer, facilitation
3. Which authority matters: OFAC, EU, UK OFSI, UN, national regulator, export-control agency, customs authority
4. Enforcement posture: new rule, new designation, guidance, warning, penalty, investigation, customs action
5. Ownership/control exposure: beneficial ownership, minority stakes, control, proxies, affiliates, front companies
6. Routing risk: transshipment, re-export, intermediaries, logistics hubs, customs anomalies, dual-use goods
7. Financial channel risk: banks, correspondent banking, payment processors, trade finance, insurance
8. Secondary sanctions or extraterritorial exposure
9. Wind-down, licenses, exemptions, humanitarian carve-outs, or general authorizations
10. Operational impact: contract performance, delivery, inventory, payment, documentation, partner screening
11. Reputational exposure even where legal exposure is unclear
12. Evidence quality: official text versus media report, rumor, leaked proposal, or analyst claim

## Signal upgrade markers

Upgrade signal strength when the item includes:

- official designation, delisting, sanctions package, regulation, executive order, Council decision, or legal text;
- enforcement action, penalty, settlement, seizure, customs detention, or indictment;
- regulator guidance, FAQ, license change, general authorization, or wind-down deadline;
- named vessels, banks, companies, beneficial owners, or intermediaries;
- export-control classification change or customs enforcement pattern;
- repeated routing evidence across trade data, official statements, and enforcement actions;
- correspondent banks, insurers, shippers, or major platforms changing behavior;
- secondary-sanctions warning or action against third-country actors;
- sanctions coordination across US/EU/UK/UN or other major regimes.

## Signal downgrade markers

Downgrade signal strength when the item is:

- political rhetoric without legal instrument or enforcement path;
- media speculation about future sanctions without named target or authority;
- single-source allegation without official action or trade-data support;
- recycled sanctions-risk commentary already priced into compliance behavior;
- broad “crackdown” language without regulator, deadline, sector, or target.

## Actor map

Consider only actors that materially change the answer:

- sanctions authorities and export-control agencies;
- customs and border agencies;
- banks, correspondent banks, insurers, payment processors, and trade-finance providers;
- exporters, importers, brokers, freight forwarders, and logistics firms;
- beneficial owners, shell companies, affiliates, and intermediaries;
- designated parties and their counterparties;
- compliance teams, legal teams, procurement, sales, and operations;
- third-country governments and enforcement partners;
- humanitarian or exempted actors where carve-outs matter.

For each important actor, assess:

- exposure;
- constraint;
- likely behavior change;
- leverage;
- risk created for the user.

## Flow map

When relevant, identify affected flows:

- money;
- goods;
- services;
- technology;
- vessels and shipping;
- insurance;
- trade finance;
- ownership/control;
- documentation and licenses.

Then state where friction, enforcement risk, or avoidance behavior concentrates.

## Default output

```markdown
**Bottom line:** ...
**Sanctions signal classification:** noise / weak signal / signal / enforcement marker / trigger event / structural shift
**What changed:** ...
**Authority and instrument:** OFAC / EU / UK / UN / export control / customs / other / unclear
**Affected parties or flows:** ...
**Exposure mechanism:** ownership / transaction / routing / finance / insurance / export control / facilitation / reputation
**Compliance impact:** ...
**Main uncertainty:** ...
**Scenarios:** ...
**Watch next:** ...
```

## Watch-next indicators

Prefer concrete indicators:

- official designation or legal text;
- regulator FAQ, guidance, license, general authorization, or deadline;
- enforcement action, penalty, seizure, indictment, settlement, or customs detention;
- named banks, vessels, companies, intermediaries, or beneficial owners;
- correspondent banking behavior, account closures, insurance withdrawal, or payment blocks;
- customs data shifts by HS code, route, country, or intermediary;
- export-control classification or licensing change;
- partner screening hits, contract suspensions, or route redesigns.

## Anti-patterns

Avoid:

- treating sanctions rumor as sanctions fact;
- saying “ensure compliance” without naming exposure mechanisms;
- ignoring licenses, exemptions, wind-down periods, or humanitarian carve-outs;
- assuming legal exposure and reputational exposure are the same;
- ignoring ownership/control and intermediary risk;
- missing the difference between designation, guidance, enforcement, and political signaling;
- presenting legal conclusions. Escalate legal determinations to qualified counsel.
