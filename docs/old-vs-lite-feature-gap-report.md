# Old AIM Studio vs Ultra AIM Studio Feature Gap Report

| Feature | Exists in Ultra/Lite | Exists in Old AIM | Keep Lite Version | Rebuild From Old | Skip | Notes / Files |
|---|---|---|---|---|---|---|
| homepage | Yes | Yes | Yes | No | No | Ultra/Lite has an optimized modern design. Old AIM has Media Manager dependencies. |
| works page | Yes | Yes | Yes | No | No | Ultra/Lite uses unified `Work` schema. Old AIM uses `Project`. |
| watch/player page | Yes | Yes | Yes | No | No | Ultra/Lite is faster and simpler. Old AIM has complex subtitle integration to review later. |
| admin dashboard | Yes | Yes | Yes | No | No | Ultra/Lite has `AdminSettings` and streamlined panels. Old has complex bespoke admin logic. |
| works editor | Yes | Yes | Yes | No | No | Ultra/Lite uses `Work` model. |
| media manager | No | Yes | No | Yes | No | Old AIM uses `PageMedia`/`HeroVideo`. Needs clean rebuild in Ultra. |
| subtitle system | No | Yes | No | Yes | No | Old AIM's `FilmSubtitle` & revision tracking is heavy. Needs a simplified rebuild. |
| users/login | Yes | Yes | Yes | No | No | Ultra/Lite uses `Auth.js` adapter. Old uses custom token/password history. |
| subscribers | Yes | Yes | Yes | No | No | Ultra/Lite has robust email suppression and preference syncing. |
| notify me | Yes | Yes | Yes | No | No | Ultra/Lite uses flexible `NotifyMeCta`. Old relies heavily on BotScore/Subscriber models. |
| casting | No | Yes | No | No | Yes | Old AIM has `CastingCall` and `Application`. Skip for Phase 1. |
| scripts | No | Yes | No | No | Yes | Old AIM has `ScriptCall`. Skip for Phase 1. |
| training | No | Yes | No | No | Yes | Old AIM has `Course`, `Enrollment`, `LessonProgress`. Skip for Phase 1. |
| continue watching | Yes | Yes | Yes | No | No | Ultra/Lite uses `WatchProgress`. Old uses `WatchHistory`. |
| content advisory | Yes | Yes | Yes | No | No | Ultra/Lite retains `contentRating` and `contentDescriptors`. |
| player timings | Yes | Yes | Yes | No | No | Ultra/Lite uses `introStart`, `introEnd`, `creditsStart` on the `Work` model. |
| mobile performance | Yes | No | Yes | No | No | Ultra/Lite is highly optimized for mobile (hero components, fluid layouts). |
| database/schema | Yes | Yes | Yes | No | No | Ultra/Lite schema (`Work`, `AnalyticsEvent`) is cleaner and easier to maintain. |
