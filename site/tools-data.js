/**
 * The catalogue shown on the launcher page (index.html).
 * Keep in sync with the folders in /tools - `npm run check:structure` fails if
 * a tool is missing here. It is a .js file (not .json) so the launcher also
 * works when opened straight from disk, where browsers block fetch().
 */
window.TOOLS = [
  {
    id: 'utm-builder',
    title: 'UTM Link Builder',
    tagline: 'Build tagged campaign links with naming rules and catch inconsistent names.',
    replaces: 'spreadsheet link lists',
    tags: ['utm', 'campaign', 'link', 'tracking'],
  },
  {
    id: 'ab-test',
    title: 'A/B Test Significance',
    tagline: 'Check whether a conversion difference is real, how big a sample you need and what it means.',
    replaces: 'online test calculators',
    tags: ['ab', 'test', 'significance', 'conversion'],
  },
  {
    id: 'roas-calculator',
    title: 'ROAS & Campaign ROI Calculator',
    tagline: 'Return on ad spend, ROI, CPA, CPC, CPM and break-even from spend and results in rupees.',
    replaces: 'ad-platform exports and calculators',
    tags: ['roas', 'roi', 'cpa', 'ads'],
  },
  {
    id: 'funnel-report',
    title: 'Funnel Report',
    tagline: 'Load a leads or stage CSV/Excel file and see stage conversion, drop-off and channel comparison.',
    replaces: 'pivot tables',
    tags: ['funnel', 'leads', 'conversion', 'channel'],
  },
  {
    id: 'cac-ltv',
    title: 'CAC & LTV Calculator',
    tagline: 'Customer acquisition cost, lifetime value, payback months and the LTV to CAC ratio.',
    replaces: 'finance-marketing spreadsheets',
    tags: ['cac', 'ltv', 'payback', 'unit'],
  },
  {
    id: 'cohort-summary',
    title: 'Cohort Retention Summary',
    tagline: 'Turn signup and activity dates into a cohort retention table and heat map.',
    replaces: 'manual cohort sheets',
    tags: ['cohort', 'retention', 'churn'],
  },
  {
    id: 'ad-copy-checker',
    title: 'Ad Copy Length Checker',
    tagline: 'Check headlines and descriptions against platform character limits before you upload.',
    replaces: 'trial and error in ad managers',
    tags: ['ad', 'copy', 'headline', 'limit'],
  },
  {
    id: 'post-planner',
    title: 'Social Post Planner',
    tagline: 'Plan posts by channel and date with caption counters, hashtags and calendar reminders.',
    replaces: 'posting spreadsheets',
    tags: ['social', 'post', 'caption', 'hashtag'],
  },
  {
    id: 'content-calendar',
    title: 'Content Calendar',
    tagline: 'Plan content by month with owners, status and deadlines; see gaps and what is late.',
    replaces: 'content trackers',
    tags: ['content', 'calendar', 'editorial'],
  },
  {
    id: 'budget-pacing',
    title: 'Budget Pacing Tracker',
    tagline: 'Compare planned and actual spend by channel and see if you are pacing ahead or behind.',
    replaces: 'budget trackers',
    tags: ['budget', 'pacing', 'spend'],
  },
];
