# Food × Hardware Fusion

Replaces ordinary monthly photography with the user's seven-field USER_INPUT structure:
CONCEPT_THEME, ORGANIC_FOOD_PART, MECHANICAL_HARDWARE_PART, PLACEMENT_AND_ANGLE,
BACKGROUND_SURFACE, LIGHTING_AND_MOOD and COLOR_PALETTE.

Each batch now contains nine active structures: food pairs selected from 16 matched
concepts, exhibition booths selected from 12 templates, plus material-art still lifes selected from
16 category-specific editorial still-life recipes, 8 dual-material sculptures and
12 three-drink beverage campaigns, 12 culinary-editorial dishes, 12 painterly
aerial landscapes, 12 editorial pen sketches and 12 symmetrical minimal storefronts.
Every active structure receives at least one slot in each ten-image batch. One
randomly selected structure receives a second least-used concept, then all ten items
are shuffled. Each type is sampled without duplicates within the batch. Booths use
the user's 17-field specification. Architectural masterplans are retired and cannot
reach paid generation. The planner rejects a catalog
larger than the ten-image batch rather than silently omitting a structure.
Before any paid image request, the planner reads a durable prompt-history ledger,
selects the least-used recipe in each structure, adds a distinct six-axis creative
direction, hashes every final prompt and reserves the whole batch with an optimistic
ETag write. A simultaneous manual or cron request must retry against the winning
ledger version, so it cannot claim the same prompt. The ledger uses its own
`adobe-stock-prompt-history/` Blob prefix and is never removed when a downloaded
batch or its images are deleted. Existing saved batch manifests seed the ledger on
first deployment. Deleted historical batches cannot be reconstructed, so all new
briefs also carry a visually meaningful creative edition rather than relying only
on the old recipe text.
Food pairs use system randomness.
Angles and neutral matte backgrounds vary independently. Pairs can recur across
batches; this is not a guarantee of lifetime uniqueness. Preparation makes no paid
planning calls. Scheduled and manual runs use the same planner.

Each food-fusion picture contains one connected food/mechanical hybrid, photographed with
credible textures on a full-bleed studio surface, soft contact shadow and copy
space. No people, lettering, logos, collage, detached hardware or decorative props.
Output is JPEG. Thai identity is carried by suitable ingredients rather than
forcing Thai locations into a studio shot.

Examples of intended use:

| Pair | Visual message | Intended buyer/use |
| --- | --- | --- |
| Pork belly + battery terminal | Culinary energy recharge | Food-as-fuel article or restaurant campaign |
| Red chili + pressure valve | Intense spice | Hot-sauce or spicy-menu launch |
| Ginger + spark plug | Warming flavor spark | Ginger drink or cooking campaign |
| Lime + faucet | Refreshment on tap | Citrus beverage menu |
| Shrimp + turbine | Speed and freshness | Seafood delivery advertisement |

These are buyer-use hypotheses, not measured sales predictions. Creative direction
is consistent with Adobe's Surreal Silliness trend:
https://business.adobe.com/resources/sdk/creative-trends-surreal-silliness.html

QA accepts deliberate fusion while checking a single connected hero, recognizable
food and hardware, joint quality, realistic materials, text/framing and visible
faces. Replacements preserve the chosen pair and studio structure. The existing
three-replacement cap and warning behavior remain.

Booths use strict frontal orthographic elevation, complete canopy and platform,
pure white studio backdrop, organized craft merchandise, believable connections
and blank signage surfaces. The no-lettering rule takes priority over the sample
brand name and subtitle so designers can add their own typography. Thai craft
identity comes from material choices and merchandise.

Booth QA permits intentional white presentation space, checks structure and
camera angle, and uses a booth-specific retry prompt. It must not apply the
food-fusion requirement to architectural objects.

Both structures remain JPEG with no people or visible human faces. Historic
downloads and saved metadata remain readable. Future structures can be represented
separately without merging incompatible USER_INPUT fields.

Architectural masterplans are retired. Historical manifests may still contain
PROJECT_THEME, PROJECT_TITLE, VIEW_AND_PERSPECTIVE,
LINEWORK_AND_TINT_STYLE, WATERPARK_AND_AMENITY_ZONE,
ACCOMMODATION_AND_STRUCTURES, LANDSCAPE_AND_TERRAIN and COLOR_PALETTE.
These historical entries were elevated bird's-eye sketches on continuous warm-white paper, with
fine graphite/ink linework and restrained pastel water, roof and planting
tints. PROJECT_TITLE stays metadata with unmarked space reserved for later
typography. New planning omits this structure and stale prepared briefs are blocked
before paid generation. The old schema remains readable only so saved batches can
still be viewed or downloaded.

All nine active structures output JPEG without visible human faces or lettering. No live image
generation is required to prepare the briefs.

Rendered text is a hard rejection for every structure. QA checks both readable
lettering and pseudo-text. After three replacement attempts, an image that still
contains either is withheld instead of being included with a warning. The same
hard-stop behavior applies when mandatory vision inspection cannot complete.

Metadata CSV files contain single-word keywords only. New briefs normalize and
deduplicate their prioritized keyword lists before display, while CSV export repeats
the normalization as a compatibility guard for historical saved batches. Phrases are
split into meaningful Unicode words, filler words are removed, source priority is
preserved, duplicates are removed and output is capped at 25 keywords.

Structures are reusable across suitable buyer categories. Booths include crafts,
coffee/food, cosmetics, technology and tourism. Adapt products, fixtures, keywords
and intended buyer use together. Food fusion remains food/hardware-specific.

The third active structure is the user's 18-field Material Art brief. It uses
CAMPAIGN_THEME through TEXT_ELEMENTS, saved separately as materialArtStructure.
This does not restore the retired automatic metaphor-conversion planner.
Material Art explicitly specifies one readable physical artwork, named raw
materials, restrained accents, camera/lens/light, a continuous textured studio
surface, natural copy space and photographic material realism. Categories
include food, coffee, textiles, bamboo, ceramics, flowers, rice and seeds.
TEXT_ELEMENTS is fixed to "No text" under the current global rule.
Validation rejects missing fields, mixed structures or visible-text requests.
QA and replacements preserve the material-built motif or named hero product; they do not demand
a food-hardware joint, architectural elevation or sketch masterplan.

Editorial Still Life extends that same 18-field structure to brand advertising,
fashion, beauty, home, stationery and travel accessories. It does not add a fifth
structure or restore the legacy automatic metaphor planner. Products retain
their recognizable normal shape; styling supplies a simple visual metaphor.
The builder supports 3:2, 16:9, 4:5 and 1:1, selecting a ratio when none is supplied
and deriving horizontal, vertical or square composition logic from it.
Background material and camera treatment vary compatibly with the subject;
upright hero products use a frontal three-quarter view. All variants retain
No text, no people, full-bleed physical studio backgrounds and JPEG output.

The fourth active structure is Dual Material, with exactly SUBJECT, PRIMARY_MATERIAL,
SECONDARY_MATERIAL, BACKGROUND, SHADOW_STYLE and VISUAL_STYLE.
It builds one recognizable animal, flower, organ-shaped sculpture, household
object or other appropriate form from two contrasting materials. The primary
material defines the main volume; a connected secondary accent preserves a
simple readable silhouette. No extra construction material, props or faces.
Animal features and non-portrait sculptural organ forms are allowed under the
human-face rule. No medical accuracy claims are made for organ-shaped artworks.
Dedicated QA and retries preserve the subject and both materials without
applying the food-hardware fusion, booth, masterplan or editorial staging rules.

The fifth active structure is Beverage Campaign, with CAMPAIGN_THEME,
HERO_DRINK_CENTER_ELEVATED, SUPPORTING_DRINK_LEFT, SUPPORTING_DRINK_RIGHT,
STAGING_PLINTHS, RELEVANT_INGREDIENT_PROPS, BACKGROUND_ENVIRONMENT,
LIGHTING_MOOD and COLOR_PALETTE. Each recipe creates exactly three separate drinks:
one elevated center hero and two lower supporting drinks forming a readable triangle.
The 12 curated recipe families pair each drink with only its actual ingredients and
define a buyer/use hypothesis. QA checks count, hierarchy, vessel geometry, support,
liquid/ice/foam/condensation realism and ingredient relevance. Replacements preserve
the same three recipes and set. No people, hands, labels, lettering or fourth drink.

The sixth active structure is Culinary Editorial. Its 11 fields cover project context,
five buyer-copy placement zones, a foreground hero dish, a single utensil-held bite,
recipe-specific raw accompaniments, a freestanding dimensional backdrop and palette.
The copy fields reserve natural negative space only: no brand title, tagline, footer,
badge or pseudo-text is rendered. This adapts the supplied example to the existing
no-text and no-visible-face rules, so its chef, hands and lettered retail pouch are
intentionally omitted. Twelve matched Thai dishes define accurate utensils,
accompaniments, buyers and uses. Dedicated QA rejects distorted food, unrelated
garnish, broken utensils, people/hands, packages, typography and poster frames;
retries preserve the same dish, lifted bite, ingredients and dimensional set.

The seventh active structure is Aerial Landscape. Its eight fields cover scene theme,
connected aerial terrain ribbons, a winding path with minuscule overhead scale
subjects, one focal landmark, gouache/chalk-pastel/stippled texture, color harmony,
the text-control field and lighting/mood. TYPOGRAPHY_OVERLAY is fixed exactly to
"None (Text-free)" and is never forwarded as a visual instruction. People, when a
recipe needs scale, remain extremely small featureless overhead marks with no face,
profile or anatomical detail. The result is a full-bleed painterly illustration,
not a map, masterplan, satellite image or infographic. Dedicated QA checks connected
terrain, route coherence, landmark support, shadow direction, medium, commercial
clarity, full-bleed edges and the global zero-text rule. Retries preserve the same
scene, route, landmark, palette, light and texture.

The eighth active structure is Editorial Pen Sketch. Its ten fields cover project theme,
location, main subject, supporting scene elements, composition, colored-pen palette,
hatching, paper, text control and mood. TEXT_ELEMENTS is fixed to "No text" and is
not forwarded as visual content. Twelve curated practical scenes define an explicit
buyer, use and reason to license the image. The named subject must be complete,
recognizable within two seconds and grounded in one coherent physical setting.
Colored technical-pen lines, directional hatching and restrained cross-hatching
must leave the full-bleed paper tooth visible; broad paint fills, photorealism,
abstract symbolism, people, hands, lettering and visible page edges are rejected.
Dedicated QA and retry instructions preserve the same theme, location, subject,
supporting objects, composition, palette, hatching, paper and mood.

The ninth active structure is Symmetrical Minimal Storefront. Its eight fields cover scene
theme, architectural façade, doors/windows/interior, storefront props/plants,
flanking flora or structures, background horizon/sky, foreground pavement and
palette/lighting. Twelve curated small-business recipes define explicit buyers,
uses and licensing reasons. Each image contains one complete standalone shop in a
strict centered straight-on eye-level architectural photograph with disciplined
bilateral symmetry, restrained contrasting pastels and bright clean daylight. The
visual language is expressed through general composition, color and production-design
traits; prompts and metadata do not name a director, film, franchise or real shop.
Dedicated QA rejects rows of shops, cropped façades, angled cameras, broken geometry,
floating props, incoherent interiors, miniatures, illustrations, people and all text.
Retries preserve all eight selected fields and the same business type. Plain boards,
awnings, packaging and display surfaces remain completely unmarked.

Old ordinary-photography briefs are blocked before paid generation. Refresh and
prepare a new batch after deployment. Historical downloads remain available.

Preview prompt: the user's pork-belly/battery example, ruby-pink meat and creamy
fat layers, copper-and-silver battery cap joined to the right end, horizontal
side view on matte ivory #F5F3EF, diffused studio light, one connected object,
soft contact shadow, generous negative space, no text or people.
