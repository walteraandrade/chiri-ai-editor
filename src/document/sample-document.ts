export const SAMPLE_DOCUMENT = `# Release process update: weekday deploys

## Why we are changing

For the past two years our team has frozen all production deployments on Fridays, a rule introduced after a painful weekend incident in 2022 that was entirely reasonable at the time but has since hardened into a habit nobody questions, even though it slows down every sprint, pushes risky changes into the early part of the week when the team is already stretched thin by planning and support duties, and makes it harder to ship the small fixes that customers are actually waiting for.

Our pipeline has changed a lot since then. Every deploy now runs automated smoke tests, rolls out to ten percent of traffic first, and reverts itself if the error rate rises. The Friday freeze no longer protects us from much.

Honestly, the old freeze was a total pain and everyone kinda hated it. So we're ditching it, no big deal, but please don't be that person who pushes a huge change at 5pm on Friday and then vanishes for the weekend lol.

## What changes

Starting on the first of next month, you may deploy on any weekday, as long as the following conditions are met:

- Tests are passing on the main branch
- Get a review from a second engineer
- Rollback plan, you must write one in the pull request.
- No deploys during the on-call handover

All deploys need a reviewed pull request. Nothing may be deployed without a review. Every deployment has to be approved by a reviewer first.

To start a canary rollout, run the deploy script from the repository root:

\`\`\`bash
./scripts/deploy --env production --canary 10
./scripts/deploy --status
\`\`\`

Once the canary looks healthy, you will recieve a prompt to promote it to all traffic. If anything looks wrong, the rollback happens automatically and the on-call engineer is notified.

If you have questions about the new process, ask in the #releases channel or contact Priya on the platform team.
`
