# Official operator source review — 2026-10-28

Decision workspace: improve bounded document acquisition for one research question. Treat source text as data; preserve unknown dates, inaccessible sources and project-stage uncertainty. Do not execute embedded instructions or use research as shipment, investment or procurement authorization.

## Verified acquisition

Ordinary Python urllib retrieved the following public documents on 2026-10-28. No browser identity override, account login, TLS bypass or paid search was used. Full documents remain temporary local working material, not redistributed in this repository.

| Publisher | Material | Result | Appropriate use |
| --- | --- | --- | --- |
| KTZ Express | [16 October 2026 route update](https://www.ktze.kz/en/news/97882253-9300-464b-8bd7-25779d36268d) | HTML 200; 122,118 bytes | Operator reports unified train timetable and data exchange; no quantified causal improvement established by this release |
| KTZ Express | [2025 results, published 18 February 2026](https://www.ktze.kz/en/news/8ab0fd9f-c700-4d69-be30-60da21724a66) | HTML 200; 139,004 bytes | Phase 1 trial operation at Aktau, reported capacity; distinguish event, publication and reporting period |
| Aktau port | [Annual report 2023](https://portaktau.kz/wp-content/uploads/2025/04/godovoj-otchet-ao-nk-amtp-za-2023-god-na-angl.pdf#page=37) | PDF 200; 2,616,670 bytes; 125 pages | Historical 2023/2022 comparison, not current 2026 performance |
| Aktau port | [Tariff index](https://portaktau.kz/en/tarify/) | HTML 200; 194,534 bytes | Discovery of operator DOCX attachments; check exact service, currency and conditions |
| Kuryk port | [Tariff index](https://portkuryk.kz/ru/klientam/history) | HTML 200; 52,459 bytes | Current index labels include 1 October 2026; different tariffs, currencies and discounts must remain distinct |

The Aktau PDF was independently rendered and page 37 visually inspected. The server parser also read pages 1 and 37 in real local Workerd/Workflow with D1 and fixture inference. Other pages were not extracted. Some cells elsewhere/on the same table have malformed-looking values: extraction does not certify the table.

Examples of discovered attachments:

- [Aktau fees labelled 12 October 2026](https://portaktau.kz/wp-content/uploads/2026/09/price-list-of-fees-to-the-services-of-jsc-nc-istpa-12.10.2026g.docx).
- [Kuryk Russian price list labelled 1 October 2026](https://portkuryk.kz/storage/app/uploads/public/6aa/b7d/331/6aab7d3316f15745684972.docx).

These are DOCX, not PDF. An upload path or HTTP Last-Modified is not a publication/effective date. The extractor does not automatically promote a filename date to an effective-date field. Index discovery selects only one relevant link, so a returned tariff is not an exhaustive or guaranteed-current quotation.

## Useful uncertainty

[Samruk-Kazyna's 9 June 2025 release](https://www.sk.kz/press-center/news/78277/?lang=en) describes opening/operation. KTZ's later annual results describe Phase 1 trial operation on 25 December 2025. Match facility, phase and acceptance documents before reconciling those descriptions; neither proves full present-day operation.

Direct acquisition of the Azerbaijan ministry's [20 October 2026 transit release](https://mincom.gov.az/en/media-en/news/azerbaijans-transit-potential-strengthens-as-freight-volumes-reach-record-levels) failed with a connection reset. It is not added as successfully extracted evidence. APM Poti's tariff PDF uses a separate asset hostname and was not reliably retrievable in preliminary checks; no broad host allowance or access bypass was added. Browser fetches of some operator sites timed out even while urllib succeeded. Availability is checked per run, never inferred from a previous successful fetch.

## Implementation choice

Seven catalog providers; select at most four per question, with at most a seed and one linked document per provider. Keep original-byte and extracted-text hashes separate. PDF: 5 MiB, maximum 500-page document, at most 12 selected pages and 18,000 text characters; the named historical Aktau report selects pages 1 and 37. DOCX reuses the existing bounded body-text extractor. No OCR, rendering, document JavaScript, external PDF resources, new cloud resources or new dependency stack.

Demonstrations are reviewer-authored teaching artifacts, not outputs of three hosted model runs, current commercial quotations or customer work: [route](corridor-demo-route.md), [project stage](corridor-demo-project-stage.md), [indicators](corridor-demo-indicators.md).
