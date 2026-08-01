# GNANZE Project Instructions

Use `GNANZE_ARCHITECTURE.md`, `GNANZE_SCHEMA.sql`, and `image.png` as recovered source artifacts. Preserve the documented business rules, but review security and implementation details before treating recovered material as production-ready.

The product interface is in French. Keep user-facing behavior accessible, responsive, role-aware, and scoped to the signed-in user's agency unless the user is a SuperAdmin.

## `_build_plan/`

The `_build_plan/` folder contains the initial PRD and per-milestone prompts used to scaffold this codebase during its initial build-out phase. These files are **temporary** - they exist for documentation and guidance only. They are **not** functional: no code, configuration, or runtime logic in this codebase should import, reference, or depend on anything inside `_build_plan/`.

Do not treat `_build_plan/` as long-living documentation for the codebase. The codebase will evolve past the assumptions and decisions captured here. Once the initial milestones are complete, this folder is expected to be deleted.

<!-- bm-design-system:start -->
## Design system

This codebase has a design system documented at [`/admin/design-system`](/admin/design-system). The page previews and explains every primitive, including colors, typography, structure, base styles, and reusable elements.

When implementing UI:

1. Check the design system first and reuse the tokens in `src/styles/design-system.css` and components under `src/components/ui/`.
2. Do not introduce raw colors, one-off type scales, or a second component variant system when an existing token or primitive fits.
3. Prefer semantic HTML for headings, paragraphs, links, lists, labels, and other base text elements because the design-system stylesheet defines their visual foundation.
4. Add a missing reusable pattern to the design system before using it broadly in product pages.
5. Re-run the `bm-design-system` skill to add sections or refresh managed tokens non-destructively.
<!-- bm-design-system:end -->
