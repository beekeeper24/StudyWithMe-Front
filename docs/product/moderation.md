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
- The panel loads pending chat message reports.
- Handling a report as resolved or rejected removes it from the pending panel.

## Admin Notification Navigation

- A notification with target type `CHAT_REPORT` opens My Page.
- If the current user is an admin, opening the notification reloads the pending report panel.
- The notification label shown in the popup is `신고`.

## Future Assignment UI

When the backend adds report assignment:

- Add an assigned-admin indicator.
- Add a "담당하기" action if reports can be claimed manually.
- Hide or disable handling actions for reports assigned to another admin unless the backend policy allows override.
