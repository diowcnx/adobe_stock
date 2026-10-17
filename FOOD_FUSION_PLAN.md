# Food × Hardware Fusion

Replaces ordinary monthly photography with the user's seven-field USER_INPUT structure:
CONCEPT_THEME, ORGANIC_FOOD_PART, MECHANICAL_HARDWARE_PART, PLACEMENT_AND_ANGLE,
BACKGROUND_SURFACE, LIGHTING_AND_MOOD and COLOR_PALETTE.

Each batch now contains eight structures: food pairs selected from 16 matched
concepts, exhibition booths selected from 12 templates and architectural masterplan
sketches selected from 12 templates, plus material-art still lifes selected from
16 category-specific editorial still-life recipes, 8 dual-material sculptures and
12 three-drink beverage campaigns, 12 culinary-editorial dishes and 12 painterly
aerial landscapes. Every structure appears at least once in each batch. The remaining
two of ten slots are assigned to two distinct structures selected with system randomness for that batch, then
all ten items are shuffled. Each type is sampled without
duplicates within the batch. Booths use the user's 17-field specification;
masterplans use the user's 8-field specification.
When the catalog reaches ten active structures, all ten slots are reserved one per
structure and no structure receives a duplicate slot. The planner rejects a catalog
larger than the ten-image batch rather than silently omitting a structure.
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

Resort masterplans use PROJECT_THEME, PROJECT_TITLE, VIEW_AND_PERSPECTIVE,
LINEWORK_AND_TINT_STYLE, WATERPARK_AND_AMENITY_ZONE,
ACCOMMODATION_AND_STRUCTURES, LANDSCAPE_AND_TERRAIN and COLOR_PALETTE.
They are elevated bird's-eye sketches on continuous warm-white paper, with
fine graphite/ink linework and restrained pastel water, roof and planting
tints. PROJECT_TITLE stays metadata with unmarked space reserved for later
typography. QA and retry rules preserve the sketch medium, complete site
boundary, coherent zoning, paths and perspective. They do not require
photorealism, frontal booth views or food fusion.

All eight structures output JPEG without visible human faces or lettering. No live image
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
coffee/food, cosmetics, technology and tourism. Masterplans include hospitality,
education, community wellness, workplaces and senior housing. Adapt products,
fixtures, buildings, amenities, keywords and intended buyer use together.
WATERPARK_AND_AMENITY_ZONE supports non-water amenities, and
ACCOMMODATION_AND_STRUCTURES supports project-appropriate buildings.
Pools/slides/villas must never be added to an unrelated project merely because
the original structure example was a waterpark resort. QA and retry prompts use
the same category-adaptation rule. Food fusion remains food/hardware-specific.

The fourth structure is the user's new 18-field Material Art brief. It uses
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

The fifth structure is Dual Material, with exactly SUBJECT, PRIMARY_MATERIAL,
SECONDARY_MATERIAL, BACKGROUND, SHADOW_STYLE and VISUAL_STYLE.
It builds one recognizable animal, flower, organ-shaped sculpture, household
object or other appropriate form from two contrasting materials. The primary
material defines the main volume; a connected secondary accent preserves a
simple readable silhouette. No extra construction material, props or faces.
Animal features and non-portrait sculptural organ forms are allowed under the
human-face rule. No medical accuracy claims are made for organ-shaped artworks.
Dedicated QA and retries preserve the subject and both materials without
applying the food-hardware fusion, booth, masterplan or editorial staging rules.

The sixth structure is Beverage Campaign, with CAMPAIGN_THEME,
HERO_DRINK_CENTER_ELEVATED, SUPPORTING_DRINK_LEFT, SUPPORTING_DRINK_RIGHT,
STAGING_PLINTHS, RELEVANT_INGREDIENT_PROPS, BACKGROUND_ENVIRONMENT,
LIGHTING_MOOD and COLOR_PALETTE. Each recipe creates exactly three separate drinks:
one elevated center hero and two lower supporting drinks forming a readable triangle.
The 12 curated recipe families pair each drink with only its actual ingredients and
define a buyer/use hypothesis. QA checks count, hierarchy, vessel geometry, support,
liquid/ice/foam/condensation realism and ingredient relevance. Replacements preserve
the same three recipes and set. No people, hands, labels, lettering or fourth drink.

The seventh structure is Culinary Editorial. Its 11 fields cover project context,
five buyer-copy placement zones, a foreground hero dish, a single utensil-held bite,
recipe-specific raw accompaniments, a freestanding dimensional backdrop and palette.
The copy fields reserve natural negative space only: no brand title, tagline, footer,
badge or pseudo-text is rendered. This adapts the supplied example to the existing
no-text and no-visible-face rules, so its chef, hands and lettered retail pouch are
intentionally omitted. Twelve matched Thai dishes define accurate utensils,
accompaniments, buyers and uses. Dedicated QA rejects distorted food, unrelated
garnish, broken utensils, people/hands, packages, typography and poster frames;
retries preserve the same dish, lifted bite, ingredients and dimensional set.

The eighth structure is Aerial Landscape. Its eight fields cover scene theme,
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

Old ordinary-photography briefs are blocked before paid generation. Refresh and
prepare a new batch after deployment. Historical downloads remain available.

Preview prompt: the user's pork-belly/battery example, ruby-pink meat and creamy
fat layers, copper-and-silver battery cap joined to the right end, horizontal
side view on matte ivory #F5F3EF, diffused studio light, one connected object,
soft contact shadow, generous negative space, no text or people.
