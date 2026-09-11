/**
 * Everything that renders or acts on a single message.
 *
 * A barrel so HomeShell - already the largest component in the app - imports
 * this group in one line rather than eight, and so the pieces can be moved or
 * split without touching it again.
 */
export { MessageBubble, type ThreadMessage } from "./MessageBubble";
export { MessageReactions } from "./MessageReactions";
export { ReactionBar } from "./ReactionBar";
export { MessageInfoModal } from "./MessageInfoModal";
export { ComposerContextBar, type ComposerContext } from "./ComposerContextBar";
export { PinnedMessageBar } from "./PinnedMessageBar";
export { ForwardMessageModal } from "./ForwardMessageModal";
export { DeleteMessageDialog } from "./DeleteMessageDialog";
