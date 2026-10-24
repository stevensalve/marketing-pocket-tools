# Ideas and good first tasks

Pick something, open an issue to say so, and follow [CONTRIBUTING.md](../CONTRIBUTING.md). Difficulty guide: **J** = suitable for a junior engineer, **M** = mid-level.

## Improvements to existing tools

| Tool             | Task                                                      | Level |
| ---------------- | --------------------------------------------------------- | ----- |
| UTM Builder      | Import existing links from CSV to audit their naming      | J     |
| UTM Builder      | Per-campaign naming templates (`{year}-{season}-{theme}`) | M     |
| A/B Test         | Multiple variants with a multiple-comparison correction   | M     |
| A/B Test         | Revenue-per-visitor test (continuous metric)              | M     |
| ROAS Calculator  | Compare two periods side by side                          | J     |
| Funnel Report    | Time spent between stages from stage dates                | M     |
| CAC & LTV        | Cohort-based LTV from an orders file                      | M     |
| Cohort Summary   | Revenue retention as well as activity retention           | M     |
| Ad Copy Checker  | More presets (Pinterest, Snapchat, Google Display)        | J     |
| Post Planner     | Import a CSV of posts                                     | J     |
| Content Calendar | Link several pieces into a campaign                       | J     |
| Budget Pacing    | Weighted plans for festival peaks                         | M     |
| All              | Translate tool text (an `i18n` helper in `shared/`)       | M     |
| All              | Playwright smoke tests for each page in CI                | M     |

## New tool candidates

| Idea                   | What it does                                    | Level |
| ---------------------- | ----------------------------------------------- | ----- |
| Campaign Brief Builder | One-page brief as PDF                           | J     |
| Email Subject Tester   | Score subject lines against simple rules        | J     |
| SEO Meta Checker       | Title and description pixel and character width | J     |
| Influencer Tracker     | Deals, deliverables, payments and dates         | J     |
| Coupon Code Planner    | Codes, limits, expiry and redemption tracking   | J     |
| Landing Page Checklist | Pre-launch checks with a score                  | J     |
| Attribution Comparer   | First-touch vs last-touch from a journeys file  | M     |
| Keyword List Manager   | Group, de-duplicate and export keywords         | M     |

## Repository and quality

- Add a screenshot gallery to the root README (J).
- Add an accessibility audit script with axe-core run from Playwright in CI (M).
