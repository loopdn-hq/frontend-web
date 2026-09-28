/**
 * What the viewer may do in one conversation.
 *
 * The server sends `features` on every conversation it serves, already
 * resolved: the role grant, the group's own settings (broadcast mode,
 * `add_member_permission`, `edit_group_permission`), and the one membership
 * case that is not a role question at all - either side of a one-to-one may
 * pin. A client asking "is this person an admin, and is this a DM, and is the
 * group in broadcast mode" is re-deriving an answer it was already given, and
 * will drift from it the first time a rule changes.
 *
 * DECIDES WHAT TO SHOW, NOT WHAT IS ALLOWED. Every write is re-checked
 * server-side; hiding a control the viewer cannot use is a courtesy.
 */

/** Feature keys, so a typo is a compile error rather than a silent denial. */
export const GROUP = {
  send: "group.message.send",
  pin: "group.message.pin",
  deleteAny: "group.message.delete.any",
  addMembers: "group.member.add",
  removeMembers: "group.member.remove",
  setRole: "group.member.role.set",
  renameMember: "group.member.rename",
  reviewJoinRequests: "group.join_request.review",
  manageJoinCode: "group.join_code.manage",
  invitePhone: "group.invite.phone",
  editSettings: "group.settings.edit",
  editPolicy: "group.settings.policy",
} as const;

export type GroupFeature = (typeof GROUP)[keyof typeof GROUP];

type HasFeatures = { features?: readonly string[] };

/**
 * Whether the viewer may do this here.
 *
 * A conversation with no `features` yet - one built optimistically before the
 * server has answered - allows nothing. Erring the other way would flash
 * controls that then vanish, which reads as a bug rather than as loading.
 */
export function allows(
  conversation: HasFeatures | null | undefined,
  feature: GroupFeature,
): boolean {
  return conversation?.features?.includes(feature) ?? false;
}
