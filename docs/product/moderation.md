# Moderation Frontend Policy

This document records moderation UI behavior.
Update it when report, admin notification, or moderation navigation behavior changes.

## Chat Message Report UI

- Show a report action only on another member's persisted, non-deleted chat message.
- Do not show a report action on the current member's own message.
- Do not show a report action on deleted messages.
- A report opens a modal where the member enters a reason.
- The API remains the source of truth for duplicate, deleted-message, and permission checks.

## Admin Report Panel

- Admin users see a `채팅 신고` panel on My Page.
- Regular users do not render the admin report panel.
- The panel supports `대기`, `처리 완료`, `기각`, and `전체` filters.
- `대기` is the actionable queue.
- In the pending queue, admins can further filter by `전체`, `미배정`, `내 담당`, and `다른 담당`.
- `처리 완료`, `기각`, and `전체` show handled report history for operational review.
- Pending reports start as unassigned.
- Admins claim an unassigned pending report with `담당하기`.
- After a successful claim, the frontend reloads notifications so the badge and popup reflect the backend read-state cleanup.
- Only the assigned admin sees resolve/reject actions.
- Handling a report as resolved or rejected removes it from the pending panel and leaves it visible in history filters.
- Report rows show reporter, reported member, assigned admin, and handler nicknames when available.
- Missing member nicknames are displayed as a safe withdrawn-member fallback instead of making numeric ids the primary UI label.
- The report reason and original message content are separated into their own blocks so admins can review the context quickly.
- Handling actions open a modal instead of immediately mutating the report.
- Admin handling notes are optional, limited to 500 characters, and displayed in handled report history when present.

## Admin Notification Navigation

- A notification with target type `CHAT_REPORT` opens My Page.
- If the current user is an admin, opening the notification switches to the pending report panel and reloads it.
- The notification label shown in the popup is `신고`.

## Future Assignment UI

When assignment notification volume grows:

- Route follow-up notifications only to the assigned admin.
- Consider moving the assignment filter server-side if client-side filtering is no longer enough for large queues.
