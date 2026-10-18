# Hypothesis ledger

Six claims, each tested against a baseline fixed **before** the run, with
seeded randomness. Rerun with `npm run hypotheses`: every number below
reproduces exactly. Raw output: `evidence/hypotheses.json`. Significance level
α = 0.01.

**1 supported, 5 refused.** The refusals are the useful part, and none was
softened.

| | claim | baseline | result | verdict |
|---|---|---|---|---|
| H1 | Rare-root links are local in the muṣḥaf-spiral placement, including across sūrahs; the legacy برج placement shows no such locality | one endpoint replaced by a random āyah, 200 draws | all links 85.7° vs 90.0° null, p = 0.005. **Cross-sūrah links 89.8°, p = 0.33.** Legacy 93.7°, p = 0.98 | **refused** |
| H2 | Lexical continuity across an isnād seam exceeds continuity across an arbitrary point in the same sūrah | paired non-seam word index, same ±8-word windows, n = 16,034 | **0.1675 vs 0.1674**; shared-root rate 39.5% vs 40.2%; z = −0.52, p = 0.70 | **refused** |
| H3 | A sūrah's last three āyāt sit nearer to direct address than its average | three random āyāt from the same sūrah, 2,000 draws, 90 sūrahs | shift −0.003, p = 0.42 | refused |
| H4 | A seeded voyage shows more of the text than chance: more distinct sūrahs, fewer revisits, in 40 legs | uniform random walk on the same relations, from the same start, 100 seeds | sūrahs 17.5 vs 13.8 (won 73/100; bar was 80); revisits **0.7 vs 9.2**; muṣḥaf-only walk: 1.5 sūrahs | refused (by its own bar) |
| H5 | At this field's scale the floating origin is needed to keep vertex quantisation invisible | absolute float32 coordinates | worst error 3.8e-6u = **7×10⁻⁴ px** at 9u viewing; half a pixel only beyond about 21,800u | refused |
| H6 | Āyāt with no person mass concentrate in particular sūrahs beyond what length explains | proportional to āyah count, χ² with df = 113 | χ² = 850 (critical 164); 47 are first āyāt, 25 are muqaṭṭaʿāt openings | **supported** |

## What the results mean

**H2 is the finding of this ledger.** It tests the master metric where the
README puts its weight: *maximum grammatical motion held against maximum
lexical continuity*. Over the whole muṣḥaf, the continuity half (`stitch`
around a seam) is the same at seams as anywhere else. That much root-sharing
inside ±8 words is a property of the text's vocabulary at that scale, not of
attribution seams. Consequences:

- `ribat = √(stitch × delta)` effectively ranks seams by **delta**, with a
  lexical gate (`shared.length > 0`) that about 40% of all points pass anyway.
- The three exemplars (هود ٢٩، ق ٢، القصص ٤–٥) still pass `npm run verify`.
  Nothing broke. What the test removes is the inference that high continuity
  at a seam is itself a sign of design.
- A stronger metric would measure continuity **against its own local
  baseline**: for example, stitch at the seam minus the mean stitch of nearby
  non-seam points, or rare roots only (idf-weighted, as in
  `lib/universe/relations.ts`). That is proposed, not done: changing the
  engine's metric is the author's decision.

**H1** splits cleanly. Directional locality under muṣḥaf order comes entirely
from roots that recur within one sūrah, which is true by construction.
Cross-sūrah root links show no locality, and the legacy برج placement shows
none either. Any "these āyāt cluster in space" reading of either field should
be checked against this.

**H4** is a fair failure of my own design. The voyage nearly eliminates
revisits (0.7 vs 9.2 in 40 legs), which is what makes it watchable. But it
beat the uniform walk on sūrah diversity in only 73 of 100 seeds, under the
pre-set bar of 80. The parameters have not been tuned to pass it. If tuned,
the test must be rerun on fresh seeds.

**H5** means the floating origin buys nothing visible at this scale. It is
kept because free flight is unbounded and costs one vector add per frame. It is
**not** evidence for any glitch cause (see GLITCH.md).

**H6, with a counterexample to the engine.** الفاتحة ١–٤
(بِسْمِ ٱللَّهِ… ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ…) have no person mass. The
engine reads person only from pronouns and verb inflection, so nominal
sentences about God in the third person register as unattributed. That is a
limit of the isnād model, not a property of the text. It is why these āyāt get
their own labelled shell rather than the silent `d = 0.5` that `distanceOf()`
gives them.

## Not hypotheses

The placement itself (direction = muṣḥaf order, radius = discourse distance)
is a **visual encoding** chosen to be transparent, not a finding. Neither it
nor the star lens carries any physical or astronomical claim, and the UI says
so on every screen.
