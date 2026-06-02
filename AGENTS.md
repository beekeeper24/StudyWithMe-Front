# AGENTS.md

## Harness Routing

Use the main Codex flow by default. Add harnesses only when they clearly reduce risk, add review value, or enable useful parallel work.

- Oh My Codex is available as an orchestration layer, but it is not the default execution path for ordinary work.
- Use Codex main flow for normal implementation, debugging, review, and documentation unless there is a concrete reason to add a harness or sub-agent.
- Use OMX team/orchestration only when work can be split into independent implementation, review, research, or verification tracks without creating file conflicts and the parallelism or second review is worth the overhead.
- Keep simple tasks in the main Codex flow. Do not add orchestration overhead for trivial edits, typo fixes, formatting-only changes, or clear one-file fixes.
- If the active runtime blocks sub-agent or team execution, state the constraint briefly and continue with the best available harness fallback.
- Use normal Codex flow for trivial edits, typo fixes, formatting-only changes, and clear one-file fixes; still verify before completion when feasible.
- Use OMX `deep-interview` when requirements, boundaries, or acceptance criteria are unclear.
- Use Superpowers `brainstorming` or `writing-plans` for new features, behavior changes, or implementation plans that need design choices.
- Use Superpowers `test-driven-development` for complex logic, authentication, authorization, data migration, concurrency, or high-risk behavior changes.
- Use Superpowers `systematic-debugging` when the bug cause is unclear.
- Use Superpowers `verification-before-completion` before completing non-trivial work.
- gstack is limited to security review only: explicitly use gstack `cso` / `/cso` when the task calls for security review.
- Do not invoke other gstack workflows or browser tools for ordinary implementation, UI QA, runtime checks, or review unless the user explicitly changes this rule.
- Use Compound Engineering only when there is an important learning, or when the same mistake/pattern has repeated at least three times. Keep these notes separate from human-facing work logs.

## Harness Composition

Use harnesses together only when they cover genuinely different parts of the work. The default path is Codex main flow; the default question is "does a harness add enough review, parallelism, or risk reduction to justify the overhead?"

- Do not run multiple planning harnesses by default. Pick one lead planning harness, then add other harnesses only for distinct follow-up roles such as parallel execution, security review, verification, or learning capture.
- Use OMX-led planning when the main uncertainty is requirements, boundaries, acceptance criteria, or how to split work across agents.
- Use Superpowers-led planning when the main uncertainty is engineering method: TDD shape, implementation sequence, debugging discipline, or a concrete written plan.
- If both OMX and Superpowers could apply, choose the lighter one that answers the blocking question. Combining both is justified only when the second harness answers a different question, not when it repeats the same planning work.
- Simple direct work:
  - Use main Codex flow.
  - Examples: typo fixes, one-file docs edits, small config edits, obvious test expectation updates.
- Ambiguous requirements:
  - Use OMX `deep-interview` before implementation.
  - Stop once acceptance criteria, boundaries, and non-goals are clear.
- New feature or behavior change:
  - Use Superpowers `brainstorming` or `writing-plans` to shape the approach when the feature goal is clear enough to plan implementation.
  - Use OMX `deep-interview` first only when the feature goal, boundaries, or acceptance criteria are still unclear.
  - Use OMX team/orchestration only if implementation, tests, docs, and review can be split safely and the parallel/review value is clear.
  - Use main Codex for final integration and verification.
- High-risk frontend logic:
  - Use Superpowers `test-driven-development`.
  - Add OMX team/orchestration only when independent test, implementation, and review tracks exist and are worth coordinating.
  - Applies to authentication state, route guards, role-based UI, API mutation flows, chat access control, notification fan-out, and WebSocket handling.
- Superpowers TDD test design:
  - Do not stop at happy-path-only tests.
  - Include meaningful edge cases that affect the feature's correctness, security, or state transitions.
  - Do not add absurd or unrealistic cases just to increase test count.
  - Split tests by feature behavior and unit boundary so each test has one clear reason to fail.
- Unclear bug:
  - Use Superpowers `systematic-debugging`.
  - Add OMX team/orchestration when one track can reproduce the issue while another inspects code/history/config.
- Security-sensitive change:
  - Use the appropriate implementation harness first.
  - Then run gstack `cso` / `/cso` for focused security review.
  - Do not replace `/cso` with gstack browse, gstack QA, generic review, or unrelated gstack workflows.
  - Applies to OAuth2, JWT, refresh tokens, secrets, deployment security, data exposure, chat access control, notification fan-out, and WebSocket security.
- Meaningful completed work:
  - Use Superpowers `verification-before-completion` before claiming completion.
  - Use Compound Engineering only for important learnings or mistakes/patterns that have repeated at least three times.
  - Update Notion work logs for human-facing study/progress context when the work is meaningful.

OMX team/orchestration is preferred when at least two of these are true:

- there are 2+ independent workstreams;
- code changes span multiple modules or ownership boundaries;
- a separate reviewer can catch risk while implementation continues;
- external docs/research can run in parallel with local code reading;
- browser/runtime verification can run separately from code edits;
- the task has enough scope that orchestration overhead is smaller than the risk of serial blind spots.

Do not use orchestration when it would create file conflicts, duplicate the same investigation, or slow down a clear small fix.

## Execution Principles

- Work as a study partner for a beginner/new-grad developer: explain important decisions briefly and keep the code structure learnable.
- Prefer simple, conventional React and TypeScript patterns before clever abstractions.
- Follow the existing app structure and CSS patterns unless a feature clearly needs extraction.
- Do not run every workflow every time.
- Choose the lightest safe workflow that covers the task risk.
- Check `git status` before edits.
- Never revert existing user changes unless the user explicitly asks.
- Work from the current state of the tree; do not reset or discard user work.
- Run feasible verification after edits.
- Keep commits scoped to one meaningful unit.

## Behavioral Guardrails

- Before meaningful implementation, state the current milestone or slice, key assumptions, unresolved uncertainty, and intended verification target briefly.
- The milestone statement must name the intended PR/review unit, not just the next tiny edit. Example: "This branch is for community list UX polish; PR only after search controls, pagination copy, row styling, tests, and docs are complete."
- If the user gives no milestone, infer a reasonable one from current context and state it before coding. Do not default to one TODO item as one PR.
- Ask the user only when the milestone, priority, or acceptance criteria would be risky to infer. Start with one or two direct questions.
- Use OMX `deep-interview`, Superpowers planning, or other planning skills only when direct questions are not enough to clarify a broad or ambiguous feature. Do not use heavy planning tools for ordinary implementation or obvious follow-up work.
- If a requirement has multiple plausible interpretations, surface the tradeoff before coding instead of silently choosing one.
- Every changed line should trace to the user request, the current plan, or cleanup caused by this change.

### Simplicity First

- Prefer the smallest conventional implementation that satisfies the acceptance criteria.
- Do not add features beyond the current slice.
- Do not add abstractions for single-use code.
- Do not add speculative flexibility, configurability, or extension points.
- Do not add broad error handling for impossible or out-of-scope scenarios.
- If an implementation is growing large, pause and simplify before continuing.

### Surgical Changes

- Touch only files needed for the current slice.
- Do not refactor adjacent code unless it is required for the current change.
- Match existing local style even if a different style would be preferable.
- Remove only dead imports, variables, functions, or files created by this change.

## Review And Learning Loop

For meaningful work, use this loop:

1. Route the task through the lightest suitable harness.
2. Implement or investigate.
3. Verify with tests, build, lint, local browser checks, Playwright if configured, or runtime checks as appropriate.
4. Run gstack `cso` / `/cso` when the change affects OAuth2, authentication, authorization, secrets, deployment security, data exposure, chat access control, notification fan-out, or WebSocket security.
5. Capture what should make the next similar task easier.

Learning notes split:

- The StudyWithMe Notion project page is an index page only. Keep this hierarchy: `작업일지 > StudyWithMe > StudyWithMe 인수인계 문서 / dated work-log pages`.
- The handoff/context document belongs in the `StudyWithMe 인수인계 문서` child page, not in the StudyWithMe project page body.
- Notion work logs are human-facing study, portfolio, and progress records. Create them as dated child pages directly under `StudyWithMe`, following the COC Rental style. Do not create an intermediate `작업일지` folder page.
- Project learnings under `docs/learnings/` are for future Codex sessions: repeated gotchas, local conventions, architectural decisions, and verification rules.
- After meaningful work, create or update a dated child work-log page directly under `StudyWithMe` so a resumed session can quickly recover context without disturbing the project index or handoff page.

## Project Defaults

- Frontend work is primarily in WSL Ubuntu under `/home/beekeeper24/projects/StudyWithMe-Front`.
- GitHub repository is `beekeeper24/StudyWithMe-Front`.
- Main frontend stack is React + TypeScript + Vite.
- Local frontend dev server should use `http://localhost:5173` unless that port is already occupied by another project; if a different port is used, report it clearly.
- Backend API default is `http://localhost:8081`.
- WebSocket default is `ws://localhost:8081/ws`.
- OAuth success redirect default is `http://localhost:5173/auth/callback`; coordinate backend runtime configuration if the frontend port changes.
- Prefer `npm run lint` and `npm run build` for local verification.
- Use local browser checks or project-configured Playwright for UI flow, OAuth callback handling, chat, notifications, and layout changes when feasible.
- Do not use gstack browse for routine frontend verification under the current project rules.
- Markdown docs should be created in the repo root or `docs/` unless a narrower location is clearly better.
- Commit messages should be written in Korean when the user asks for project commits, and each commit should represent one reviewable intent.

## Git Flow

- Use Git Flow-style branch management.
- `main` is the stable release branch. Do not commit or push routine work directly to `main`.
- `develop` is the integration branch. Merge into `develop` only after a coherent issue, feature, domain, infrastructure, or MVP slice is locally verified and PR-ready.
- Create work branches from `develop` for each GitHub issue or coherent implementation slice.
- A work branch represents one reviewable deliverable, such as OAuth UI, board UX, chat access control, notification flow, infrastructure setup, or a domain feature. Do not open and merge a PR merely because one intermediate task ended.
- Group related small fixes, UI polish, docs, and copy changes by user-visible flow or reviewable intent instead of opening a PR for every tiny edit.
- Use a separate small PR immediately only for a real hotfix, failing CI/runtime breakage, or a change that must land before the broader feature can continue.
- Keep incremental checkpoint commits on the same work branch while that deliverable is still in progress.
- Split a large feature into multiple PRs only when each PR leaves `develop` coherent, runnable, and understandable on its own.
- Use branch prefixes: `feature/...`, `fix/...`, `test/...`, `refactor/...`, `chore/...`, `docs/...`, `release/...`, and `hotfix/...`.
- Do not use a `codex/` branch prefix.
- Push work branches and `develop` as needed. Promote to `main` only through an intentional release step.
- Split commits by reviewable intent, not by tool run.
- When the user asks to commit during an active work branch, commit the verified checkpoint and push the branch if useful; do not open or merge a PR unless the issue/feature/MVP slice is ready or the user explicitly asks for a PR.
- Before opening a PR, run this PR readiness gate and do not skip it:
  - Name the reviewable deliverable in one sentence.
  - Confirm all closely related small edits for that deliverable are included, or explain why they must be split.
  - Confirm this is not merely an intermediate checkpoint.
  - Confirm the change is not better held on the current branch for the next related task.
  - If the gate fails, commit locally if useful, keep the branch open, and continue instead of creating a PR.
- Small PRs are acceptable only for hotfixes, failing CI/runtime breakage, security fixes that must land immediately, or when the user explicitly asks to land that narrow change.
- When the issue/feature/MVP slice is ready for integration, treat the default completion path as:
  1. commit all verified work on the work branch;
  2. push the work branch;
  3. open or update a PR into `develop`;
  4. mark the PR ready after local verification and any required CI/review checks;
  5. merge it into `develop`;
  6. sync local `develop`.
- Stop at a draft/open PR only when the user explicitly asks for review-only handling, when verification is incomplete, or when CI/conflicts/blockers make merge unsafe. State the blocker and next activation step clearly.

## Reporting

Final responses should briefly report:

- what changed;
- what verification ran;
- what learning or handoff note was updated;
- any follow-up activation step that still requires the user.
