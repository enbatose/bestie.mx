/** Map claim-save room patches onto existing rows when client IDs drifted. */

export function resolveClaimSaveRoomTargets(
  existingIdsInSortOrder: string[],
  requestedIds: Array<string | null | undefined>,
): Array<{ existingId: string | null }> {
  const assigned = new Set<string>();
  const existingSet = new Set(existingIdsInSortOrder);
  return requestedIds.map((requested, index) => {
    const id = typeof requested === "string" ? requested.trim() : "";
    if (id && existingSet.has(id) && !assigned.has(id)) {
      assigned.add(id);
      return { existingId: id };
    }
    const byIndex = existingIdsInSortOrder[index];
    if (byIndex && !assigned.has(byIndex)) {
      assigned.add(byIndex);
      return { existingId: byIndex };
    }
    const fallback = existingIdsInSortOrder.find((candidate) => !assigned.has(candidate));
    if (fallback) {
      assigned.add(fallback);
      return { existingId: fallback };
    }
    return { existingId: null };
  });
}
