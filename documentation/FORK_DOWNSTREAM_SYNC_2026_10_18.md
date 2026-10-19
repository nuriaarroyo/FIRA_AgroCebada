# Downstream synchronization and website audit — 2026-10-18

## Upstream provenance

- Original repository: https://github.com/nuriaarroyo/todoseboso
- Starting upstream snapshot: `780f2034a73f0ea43d8eee639650f3db2c306875`.
- Additional upstream snapshot imported during the audit: `a538767267861bb207726a72eb60c161f832afbf`.
- Fork target: https://github.com/heri-espino/todoseboso, branch `sync/upstream-20261018-evidence`.
- Imported changes as Git commits with upstream and fork parents, preserving merge ancestry for future syncing.

## Exact tree audit

The final upstream tree contains **829 regular files**. All 829 are present in
the fork's synchronization branch. Only four shared paths intentionally differ:
`README.md` (fork website links), `scripts/520_validate_repository_documentation.py`
(portable checks of historical sources and private links), `.gitattributes`
(the binary PNG exception), and
`results/reference26_distribution/v1/distribution_ECDF.png`
(the CRC-verified repair detailed below). All upstream paths are present;
the fork-only site/validation assets remain preserved.
The actual model implementation under `src/`, original champions' 65-fold
and 97/41 numeric results, and all hidden-target outputs were **not** edited
by this synchronization.

## New upstream research evidence

1. `results/core4_relevance/v1`: leave-one-variable-out C-T3 ablations,
   conditionally adjusted diagnostic associations and Holm-corrected tests.
   HHI is context-dependent and removing it improves one spatial protocol.
2. `results/reference26_component_evidence/v1`: recovered original
   component comparisons and learned local-expert weights. R3 improves
   descriptive RMSE across four historical protocols in this architecture.
3. `results/reference26_distribution/v1`: the original ECDF figure and
   public aggregated comparison of 138 observed yields versus 59 Reference26
   estimates, including composition by state. Distinct groups are **not**
   a paired error evaluation and provide no ground-truth error for the 59.

The model remains Reference26 and Compact14; no promotion took place.

## Validation fixes, recorded rather than hidden

The upstream repository's `scripts/520_validate_repository_documentation.py`
originally failed after checkout in GitHub Actions on a historic design
checksum and then on a hyperlink into an intentionally private, gitignored
`outputs/` file. The fork's two narrowly scoped changes are:

- accept bytewise *LF/CRLF-equivalent* historical design contents; **changed
  words or mismatched other bytes still fail**;
- permit missing links only when their resolved destination lies under the
  intentionally unversioned `data/`, `outputs/` or `docs/resources/`
  roots. Missing public/documentation links remain failures.

The CI job now runs the comprehensive upstream validator, original website
checks, new interpretation/figure source-parity checks, and JS syntax check.
Do not claim cold refits or independent model validation from these tests.

## Restoring a malformed upstream PNG

GitHub Actions detected that the new ECDF image did not begin with the PNG
signature. Upstream `.gitattributes` marked all `results/**` as LF text, which
collapsed CRLF byte pairs **inside a binary image**, corrupting its PNG chunks.
The image contained 139,177 bytes, where exactly three CR bytes had been
removed: one from the eight-byte PNG signature and two in the first IDAT chunk.

A CRC32 constrained search reconstructed the **unique** pair of missing IDAT
positions (two among 197 candidate newline positions). After restoration,
all seven PNG chunk CRCs and boundaries validate; the repaired image has
139,180 bytes. The corrected original is retained under
`results/reference26_distribution/v1/distribution_ECDF.png` and copied
byte-for-byte to `site/media/distribution_ECDF.png`. A more specific binary
attribute in `.gitattributes` prevents future LF conversion of PNG/JPEG files.
The public site QA checks PNG signature, source-copy identity and figures'
reported aggregate statistics.

This is an artifact-format correction, not a model change or a fabricated
ECDF curve. The upstream binary remains malformed as of the sourced snapshot;
its maintainer may wish to adopt the same `.gitattributes` fix.

## Website publication

- Canonical presentation: `site/` → GitHub Pages root.
- Preserved alternative presentation: `website/` → `/alternate/`.
- Only `.github/workflows/publish_story.yml` deploys; the alternative
  workflow validates only, avoiding competing deployments to one Pages site.
- Deployment depends on GitHub Pages first being enabled by the fork owner in
  Settings → Pages → Build and deployment → GitHub Actions. Prior workflow
  authorization could not create the Pages site automatically.
- No raw data, per-parcel observed yields, secrets, or serialized ML models
  were published.

## Rechecking after an upstream update

On each new upstream commit, compare the upstream and fork Git trees, merge
without overwriting fork-only assets, recheck model definitions and aggregate
tables, then update only the verified website figures and their source
references. Keep separate historical validation protocols and do not treat
new research on the same 138 labels as independent confirmation.
