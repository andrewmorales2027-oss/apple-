# Local modifications to `leonxlnx/taste-skill`

Upstream: https://github.com/leonxlnx/taste-skill @ `ccbc15639c97057cbfcf32ecebc38ef716e4bb37`

Twelve of the thirteen upstream skills are installed. Everything below is a deliberate local
change; nothing here is upstream's opinion. To get the unmodified library, reinstall from source.

Skills are stored in `.agents/skills/<name>/` and symlinked from `.claude/skills/<name>/`,
matching the convention already used by the `emilkowalski/skills` install in this repo.

---

## 1. Directory names follow frontmatter, not upstream folders

Claude Code matches a skill by its frontmatter `name`, so each skill is installed under that
name rather than its upstream folder name.

| Upstream folder | Installed as |
| --- | --- |
| `taste-skill` | `design-taste-frontend` |
| `brutalist-skill` | `industrial-brutalist-ui` |
| `minimalist-skill` | `minimalist-ui` |
| `soft-skill` | `high-end-visual-design` |
| `redesign-skill` | `redesign-existing-projects` |
| `stitch-skill` | `stitch-design-taste` |
| `gpt-tasteskill` | `gpt-taste` |
| `output-skill` | `full-output-enforcement` |
| `image-to-code-skill` | `image-to-code` |
| `brandkit`, `imagegen-frontend-web`, `imagegen-frontend-mobile` | unchanged |

## 2. `taste-skill-v1` was not installed

Upstream ships it only for backward compatibility; its own description defers to
`design-taste-frontend`. It also contradicts the current version on motion discipline, requiring
an infinite loop on every Bento card where the current version requires each animation to be
justified. Two skills with near-identical descriptions and opposing rules is a triggering hazard,
so it is omitted. Reinstall it from upstream if a project genuinely depends on v1 behavior.

## 3. Precedence blocks added to six skills

Inserted immediately after the frontmatter of `minimalist-ui`, `industrial-brutalist-ui`,
`high-end-visual-design`, `gpt-taste`, `stitch-design-taste`, and `redesign-existing-projects`.

The upstream skills were written independently and contradict each other on concrete points, with
nothing saying which wins. Each block names what that skill overrides in `design-taste-frontend`,
what the base skill still governs regardless, and that two aesthetic presets must never be loaded
together. Conflicts resolved:

| Question | Resolution |
| --- | --- |
| `rounded-full` on primary CTAs | Preset decides. `minimalist-ui` bans it, `high-end-visual-design` requires it. Either satisfies the base skill's Shape Consistency Lock at a fixed value. |
| `Fraunces` / `Instrument Serif` | Base skill wins. It bans both by name; `stitch-design-taste` recommended them. |
| Eyebrow labels | Split. `high-end-visual-design` decides the styling, the base skill decides the count (max 1 per 3 sections). |
| Infinite-loop card motion | Base skill wins. Every animation must be justifiable as hierarchy, storytelling, feedback, or state transition. |
| Centered hero | Base skill wins on the default. `gpt-taste` called it "highly preferred"; it is now one of three options, for manifesto and launch briefs only. |
| `Inter` | `industrial-brutalist-ui` may use it as macro-display type. Banned elsewhere. |
| Nested containers | `high-end-visual-design`'s Double-Bezel is an explicit exception to `image-to-code` section 16, capped at two levels. |

## 4. Descriptions rewritten on ten skills

Upstream descriptions overlap heavily, so several skills fired on the same request and then
contradicted each other. Rewritten so triggering is disjoint:

- The five aesthetic presets now say **invoke only when the user names this look**, and point at
  `design-taste-frontend` for general frontend work.
- The four image-generation skills are prefixed **REQUIRES AN IMAGE-GENERATION TOOL**, since they
  are unusable without one and their fallback behavior was previously unstated. They now say to
  report the absence rather than substitute hand-rolled SVG, which the base skill bans anyway.
- `stitch-design-taste` now states up front that it emits a `DESIGN.md`, not code.
- `redesign-existing-projects` now states its relationship to `design-taste-frontend` section 11.

No rule content was changed by these edits, only the frontmatter `description` line.

## 5. `gpt-taste`: fake Python RNG replaced with a real variance mechanism

Upstream section 1 required simulating a Python `random.choice()` seeded on the prompt's character
count, and printing mock interpreter output in a `<design_plan>` block. That produces a
deterministic-looking justification for whichever option the model was going to pick anyway. It is
theater, not variance.

Replaced with: state each pick, give a one-clause reason drawn from the brief, and name any pick
reused from an earlier build in the conversation so it gets replaced. That is the mechanism that
actually stops the loop. If a genuine coin-flip is wanted, the skill now says to run a real RNG and
report its true output. Section 8's `<design_plan>` requirement was updated to match, and two stale
references in section 3 were corrected.

## 6. `design-taste-frontend`: dead Block Library reference corrected

Section 12 specifies a `blocks/` directory with a frontmatter schema and eight required body
sections per block, and section 10 said implementations "live in the Block Library." No blocks ship
upstream and no `blocks/` directory exists, so an agent following section 10 would go looking for
files that were never written.

Both sections now state that the schema is unpopulated, that section 10 is a vocabulary with no
implementations behind it, and that the only canonical implementations in the file are the three
skeletons in sections 5.A, 5.B, and 5.C. The example path was also corrected: it pointed at
`skills/taste-skill/blocks/`, which does not match this install layout.

## 7. Unmodified

`full-output-enforcement` is installed exactly as upstream wrote it.
