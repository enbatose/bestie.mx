import {
  collectRoomFieldIssueDetails,
  isStandaloneRoomPost,
  roomSaveIssuesHeading,
  roomSaveIssuesOpenLabel,
  roomsWithFieldIssues,
  type RoomFieldIssue,
} from "@/lib/publishWizard/roomWizardValidation";
import type { Draft, RoomDraft } from "@/pages/PublishWizardPage";

type Props = {
  draft: Draft;
  prefix: string;
  onOpenRoom: (index: number, issue?: RoomFieldIssue) => void;
};

function IssueJumpButton({
  issue,
  onClick,
}: {
  issue: RoomFieldIssue;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 w-full items-center text-left font-medium underline decoration-warning-fg/50 underline-offset-2 transition hover:decoration-warning-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-h-0 sm:w-auto"
    >
      {issue.message}
    </button>
  );
}

export function RoomSaveIssuesCallout({ draft, prefix, onOpenRoom }: Props) {
  const rows = roomsWithFieldIssues(draft);
  if (!rows.length) return null;
  const hideRoomIdentity = isStandaloneRoomPost(draft);

  return (
    <div
      className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-3 text-sm text-warning-fg"
      role="status"
    >
      <p className="font-semibold">{roomSaveIssuesHeading(draft, prefix)}</p>
      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li
            key={row.index}
            className={
              hideRoomIdentity
                ? ""
                : "rounded-lg border border-warning/25 bg-surface/70 px-3 py-2.5"
            }
          >
            {hideRoomIdentity ? null : <p className="font-semibold text-body">{row.label}</p>}
            <ul
              className={`list-disc space-y-1 pl-4 text-xs leading-relaxed text-warning-fg ${
                hideRoomIdentity ? "" : "mt-1.5"
              }`}
            >
              {row.issues.map((issue) => (
                <li key={issue.id}>
                  <IssueJumpButton issue={issue} onClick={() => onOpenRoom(row.index, issue)} />
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onOpenRoom(row.index, row.issues[0])}
              className="mt-2.5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition hover:brightness-110 sm:w-auto"
            >
              {roomSaveIssuesOpenLabel(draft, row.label)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RoomLocalIssuesCallout({
  draft,
  room,
  onFocusIssue,
}: {
  draft: Draft;
  room: RoomDraft;
  onFocusIssue: (issue: RoomFieldIssue) => void;
}) {
  const issues = collectRoomFieldIssueDetails(draft, room);
  if (!issues.length) return null;
  return (
    <div
      className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-3 text-sm text-warning-fg"
      role="status"
    >
      <p className="font-semibold">
        {isStandaloneRoomPost(draft)
          ? "Completa lo que falta para guardar."
          : "Completa lo que falta en esta recámara para guardar."}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed">
        {issues.map((issue) => (
          <li key={issue.id}>
            <IssueJumpButton issue={issue} onClick={() => onFocusIssue(issue)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
