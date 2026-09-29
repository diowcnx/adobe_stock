# Weekly image brief strategy

Each production run requests ten separate image briefs for that day's category. Bangkok local weekday selects both the category and the image mode. Regular work is named `.jpeg`; isolated reusable assets are named `.png` after the existing transparency-processing step.

| Bangkok day | Brief category | Typical buyer/use | Output |
|---|---|---|---|
| Monday | Wall art | Interior designers and print publishers | JPEG, full-bleed artwork |
| Tuesday | Wedding stationery | Invitation designers assembling botanical layouts | PNG design elements |
| Wednesday | Afro-bohemian interiors | Interior editors and home decor publishers | JPEG commercial scenes |
| Thursday | Circus nursery interiors | Nursery decor publishers, family brands, and interior designers | JPEG commercial scenes |
| Friday | Community art events | Local arts organizations, municipalities, and community publishers | JPEG staged commercial scenes |
| Saturday | Climate adaptation | Water and building communications | PNG explanatory elements |
| Sunday | Accessible living | Inclusive housing and community service publishers | JPEG commercial scenes |

## What the research supports

Etsy's Spring/Summer 2026 Seller Trend Report says its guidance uses Etsy search data. It reports year-over-year rises in searches for wall art decor (+110%), gallery prints (+80%), and abstract art (+38%); it also reports increased searches related to botanical weddings, journals, and playful hobbies. These signals support trying the related buyer briefs, but apply to Etsy searches and products, not Adobe Stock downloads or earnings.

Pinterest Predicts 2026 reports increases in global English-language Pinterest searches for “circus interior” (+130%), “circus nursery” (+50%), “afrobohemian home decor” (+220%), and “adire fabric” (+130%). Its published comparison uses normalized searches from September 2024–August 2025 against September 2023–August 2024. Those are search-interest changes on Pinterest, not sales. The signals support testing circus nursery and Afro-bohemian interior briefs, with source-specific design details.

Adobe's 2026 Creative Trends report recommends playful imagery, emotional connection, and local stories made with the relevant community. This supports testing community art event scenes, but the AI-generated images are staged concepts, not documentation of actual local people or events. Community briefs therefore avoid identifiable faces, named locations, and claims of documentary authenticity. Cultural references such as Nigerian Adire or Ethiopian art must be used only when the visible work actually represents that source; do not collapse distinct traditions into a generic “African” pattern.

Climate adaptation and accessible living remain in the schedule because they describe specific communication needs and visual subjects for business and public-service buyers. The research checked here does not establish their Adobe Stock sales volume. They are testable hypotheses, not “high-demand” rankings.

Sources checked 29 September 2026:

- Etsy, [Seller Trend Report: Spring and Summer 2026](https://www.etsy.com/ca/seller-handbook/article/1473931456647), published 17 March 2026. The report does not provide Adobe Stock sales data.
- Pinterest, [Predicts 2026 newsroom summary](https://newsroom.pinterest.com/news/pinterest-predicts-nonconformity-self-preservation-and-escapism-drive-21-trends-for-2026/) and [2026 trend report](https://business.pinterest.com/pdf/pinterest-predicts/2026-trend-report/), checked 29 September 2026.
- Adobe, [Creative Trends 2026](https://business.adobe.com/resources/creative-trends-report.html). The report forecasts creative directions rather than ranking Adobe Stock product sales.
- Google, [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing), checked 29 September 2026: Gemini 3.1 Flash Lite Image standard output is about $0.0336 per 1K image; the previous Gemini 2.5 Flash Image standard output was $0.039 per image. Ten 1K images are about $0.34 versus about $0.78 for twenty previous-model images, before input tokens and any provider or resolution differences. Actual OpenRouter credits are the source of truth for each account's charges.
- OpenRouter, [model listings](https://openrouter.ai/api/v1/models), queried 29 September 2026: concept planning uses `google/gemini-3.1-flash-lite` at $0.25/M input tokens and $1.50/M output tokens. It is used for one planning request per batch; if that request fails, curated prompts are used without retrying.

The generator's system prompt asks for distinct subjects and buyer-specific applications and rejects obvious duplicate concepts. It cannot verify that an image or concept is unique across all marketplace uploads. Review the finished image, title, and keywords before submission. A text instruction alone cannot guarantee that a model will not draw text or watermark-like artifacts.

Adobe Stock result counts are dynamic and can vary by locale, filters, and time. Search counts pasted into the request are kept as a point-in-time clue only; they do not prove demand, competition, or conversion. The broad “woven basket” page independently displayed 629,702 results in a Polish locale when checked, rather than the 615,865 in the supplied snapshot. Adobe Stock search pages for several specific phrases could not be independently opened in this review. The comparison should therefore be used to generate long-tail experiments, not to promise low competition or sales.
