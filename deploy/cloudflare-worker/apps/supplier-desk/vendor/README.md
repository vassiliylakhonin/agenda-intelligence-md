# Browser document dependencies

The pinned build dependencies are distributed only in the separately requested
`/supplier-document-worker.js` browser bundle. They do not run inside the
Cloudflare request handler. Library license comments remain in the generated
bundle; complete licenses are in the pinned npm distributions.

- `pdfjs-dist` 6.4.299 (Apache-2.0): legacy browser API and parser, byte-only
  extraction inside a dedicated worker; no PDF rendering or scripting.
- `fflate` 0.8.3 (MIT): bounded DOCX ZIP reading and current-source ZIP export.
- `saxes` 6.0.0 (ISC): namespace-aware XML text, without DTDs or external entities.
- `pdf-lib` 1.17.1 and `@pdf-lib/fontkit` 1.1.1 (MIT): reviewer PDF and font subset.
- Noto Sans Regular, SIL Open Font License 1.1, [OFL.txt](OFL.txt).
  Source: `googlefonts/noto-fonts` commit
  `ffebf8c1ee449e544955a7e813c54f9b73848eac`,
  `hinted/ttf/NotoSans/NotoSans-Regular.ttf`. Unmodified, embedded locally.

No runtime CDN, remote parser, font fetch or document upload. PDF export fails
explicitly for unsupported glyphs instead of dropping them; Markdown and JSON
retain arbitrary Unicode. The embedded font covers Latin, Cyrillic and Greek,
not every writing system. Parsing text never establishes authenticity or truth.
