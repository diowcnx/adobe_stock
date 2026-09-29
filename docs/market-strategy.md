# Weekly image brief strategy

Each production run requests ten separate image briefs for that day's category. Bangkok local weekday selects both the category and the image mode. Regular work is named `.jpeg`; isolated reusable assets are named `.png` after the existing transparency-processing step.

| Bangkok day | Brief category | Typical buyer/use | Output |
|---|---|---|---|
| Monday | Wall art | Interior designers and print publishers | JPEG, full-bleed artwork |
| Tuesday | Wedding stationery | Invitation designers assembling botanical layouts | PNG design elements |
| Wednesday | Tactile branding | Craft brands and packaging designers | JPEG commercial scenes |
| Thursday | Playful learning | Educational publishers and family activity designers | PNG design elements |
| Friday | Local hospitality | Independent hotels and responsible tourism campaigns | JPEG commercial scenes |
| Saturday | Climate adaptation | Water and building communications | PNG explanatory elements |
| Sunday | Accessible living | Inclusive housing and community service publishers | JPEG commercial scenes |

## What the research supports

Etsy's Spring/Summer 2026 Seller Trend Report says its guidance uses Etsy search data. It reports year-over-year rises in searches for wall art decor (+110%), gallery prints (+80%), and abstract art (+38%); it also reports increased searches related to botanical weddings, journals, and playful hobbies. These signals support trying the related buyer briefs, but apply to Etsy searches and products, not Adobe Stock downloads or earnings.

Adobe's 2026 Creative Trends report highlights tactile sensory imagery, human connection, playfulness, and local cultural expression. This informs the tactile branding, learning, and hospitality briefs; it is a trend forecast, not evidence of purchase volume.

Climate adaptation and accessible living are included because they describe specific communication needs and visual subjects for real business and public-service audiences. The research checked here does not establish their Adobe Stock sales volume. They are testable hypotheses, not “high-demand” rankings.

Sources checked 29 September 2026:

- Etsy, [Seller Trend Report: Spring and Summer 2026](https://www.etsy.com/ca/seller-handbook/article/1473931456647), published 17 March 2026. The report does not provide Adobe Stock sales data.
- Adobe, [Creative Trends 2026](https://business.adobe.com/resources/creative-trends-report.html). The report forecasts creative directions rather than ranking Adobe Stock product sales.
- Google, [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing), checked 29 September 2026: Gemini 3.1 Flash Lite Image standard output is about $0.0336 per 1K image; the previous Gemini 2.5 Flash Image standard output was $0.039 per image. Ten 1K images are about $0.34 versus about $0.78 for twenty previous-model images, before input tokens and any provider or resolution differences. Actual OpenRouter credits are the source of truth for each account's charges.
- OpenRouter, [model listings](https://openrouter.ai/api/v1/models), queried 29 September 2026: concept planning uses `google/gemini-3.1-flash-lite` at $0.25/M input tokens and $1.50/M output tokens. It is used for one planning request per batch; if that request fails, curated prompts are used without retrying.

The generator's system prompt asks for distinct subjects and buyer-specific applications and rejects obvious duplicate concepts. It cannot verify that an image or concept is unique across all marketplace uploads. Review the finished image, title, and keywords before submission. A text instruction alone cannot guarantee that a model will not draw text or watermark-like artifacts.
