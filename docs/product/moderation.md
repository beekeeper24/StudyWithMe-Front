# Moderation Frontend Policy

This document records moderation UI behavior.
Update it when report, admin notification, or moderation navigation behavior changes.

## Chat Message Report UI

- Show a report action only on another member's persisted, non-deleted chat message.
- Do not show a report action on the current member's own message.
- Do not show a report action on deleted messages.
- A report opens a modal where the member enters a reason.
- The API remains the source of truth for duplicate, deleted-message, and permission checks.

## Community Content Report UI

- Show a report action on another member's community post, comment, or reply.
- Do not show the report action as the primary action on the current member's own content; own content keeps edit/delete controls.
- A report opens a modal where the member enters a reason.
- Post reports show the post title and body snapshot in the modal.
- Comment/reply reports show the parent post title when available and the comment body snapshot in the modal.
- The API remains the source of truth for duplicate, deleted-content, and permission checks.

## Admin Report Panel

- Admin users see `채팅 신고` and `커뮤니티 신고` panels on My Page.
- Regular users do not render admin report panels.
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
- The report reason and original message/content snapshot are separated into their own blocks so admins can review the context quickly.
- Handling actions open a modal instead of immediately mutating the report.
- Admin handling notes are optional, limited to 500 characters, and displayed in handled report history when present.
- In the `커뮤니티 신고` handling modal, admins can select target deletion only while resolving a report.
- Rejected community reports do not show the deletion action.
- In the `채팅 신고` handling modal, admins can select target message deletion only while resolving a report.
- Rejected chat reports do not show the deletion action.
- Handled community report rows show when the target was deleted.
- Handled chat report rows show when the target message was deleted.

## Admin Member Sanction UI

- Admin report rows expose a `제재 이력` action for the reported member.
- Opening sanction history loads `GET /api/v1/admin/member-sanctions?targetMemberId={memberId}` and renders the result inline in the report row.
- Assigned admins can record `WARNING`, `SUSPENSION`, or `BAN` sanctions from a pending report row.
- The admin who handled a resolved report can still record a follow-up sanction from the resolved history row.
- Sanctions are created through `POST /api/v1/admin/member-sanctions` with the report source type and report id.
- `WARNING` remains record-only.
- `SUSPENSION` and `BAN` rely on backend account-status enforcement. When the API returns `AUTH-006`, the frontend clears the active session and shows an account restriction notice.

## Admin Notification Navigation

- A notification with target type `CHAT_REPORT` opens My Page.
- A notification with target type `CONTENT_REPORT` opens My Page.
- If the current user is an admin, opening the notification switches to the pending report panel and reloads it.
- The notification label shown in the popup is `신고`.

## Future Assignment UI

When assignment notification volume grows:

- Route follow-up notifications only to the assigned admin.
- Consider moving the assignment filter server-side if client-side filtering is no longer enough for large queues.
