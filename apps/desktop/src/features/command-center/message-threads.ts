/**
 * Thread grouping for the MESSAGES panel: replies nest under the message
 * they answer, via the `replyTo` field written into the protocol (spec §14).
 *
 * Kept free of React so `node --test` can verify it directly from
 * test/message-threads.test.js.
 */

export interface ThreadableMessage {
  id: string;
  replyTo?: string | null;
  createdAt: string;
}

export interface MessageThread<T extends ThreadableMessage> {
  /** Earliest member — the message the thread hangs off. */
  root: T;
  /** All messages in the thread, oldest first: root, then replies. */
  members: T[];
  /** createdAt of the newest member; threads order by recency of activity. */
  latestAt: string;
}

/** ISO-8601 timestamps compare lexicographically; break ties by id. */
function compareChronological<T extends ThreadableMessage>(a: T, b: T): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Group messages into threads.
 *
 * - A message whose `replyTo` names an existing message joins that one's
 *   thread; chains (C → B → A) resolve up to the root, so every thread is
 *   one flat group.
 * - Dangling `replyTo` (target deleted) and messages without `replyTo` start
 *   their own thread.
 * - Cycles in malformed data cannot loop: each message still lands in
 *   exactly one thread and nothing throws.
 * - Threads sort by newest activity (descending); members sort oldest first
 *   so replies always read under their root, regardless of input order.
 */
export function groupIntoThreads<T extends ThreadableMessage>(
  messages: T[],
): MessageThread<T>[] {
  const byId = new Map<string, T>();
  for (const message of messages) byId.set(message.id, message);

  const resolveRootId = (message: T): string => {
    let currentId = message.id;
    const seen = new Set<string>([currentId]);
    for (;;) {
      const parentId = byId.get(currentId)?.replyTo ?? null;
      if (!parentId || !byId.has(parentId) || seen.has(parentId)) return currentId;
      seen.add(parentId);
      currentId = parentId;
    }
  };

  const groups = new Map<string, T[]>();
  for (const message of messages) {
    const rootId = resolveRootId(message);
    const bucket = groups.get(rootId);
    if (bucket) bucket.push(message);
    else groups.set(rootId, [message]);
  }

  const threads: MessageThread<T>[] = [];
  for (const members of groups.values()) {
    members.sort(compareChronological);
    threads.push({
      root: members[0],
      members,
      latestAt: members[members.length - 1].createdAt,
    });
  }
  threads.sort((a, b) => {
    if (a.latestAt !== b.latestAt) return a.latestAt < b.latestAt ? 1 : -1;
    return a.root.id < b.root.id ? -1 : a.root.id > b.root.id ? 1 : 0;
  });
  return threads;
}

/** Flatten threads back into the exact visual order the panel renders. */
export function flattenThreads<T extends ThreadableMessage>(
  threads: MessageThread<T>[],
): T[] {
  return threads.flatMap((thread) => thread.members);
}

/** Rows a long thread shows while collapsed: its newest two. */
export const COLLAPSED_THREAD_ROWS = 2;

/**
 * How many older members a "show N earlier" toggle would reveal.
 * 0 means the thread is short enough to render in full.
 */
export function hiddenMemberCount<T extends ThreadableMessage>(
  thread: MessageThread<T>,
): number {
  return Math.max(0, thread.members.length - COLLAPSED_THREAD_ROWS);
}

/**
 * The members a thread actually renders: the newest two while collapsed,
 * every member once its root id is in `expanded` (or the thread is short).
 */
export function visibleThreadMembers<T extends ThreadableMessage>(
  thread: MessageThread<T>,
  expanded: ReadonlySet<string>,
): T[] {
  if (hiddenMemberCount(thread) === 0 || expanded.has(thread.root.id)) {
    return thread.members;
  }
  return thread.members.slice(-COLLAPSED_THREAD_ROWS);
}

/**
 * Flatten only the visible rows, in exact render order — the sequence the
 * j/k keyboard walk and scroll-into-view must follow so a hidden message
 * can never be selected.
 */
export function flattenVisibleThreads<T extends ThreadableMessage>(
  threads: MessageThread<T>[],
  expanded: ReadonlySet<string>,
): T[] {
  return threads.flatMap((thread) => visibleThreadMembers(thread, expanded));
}
