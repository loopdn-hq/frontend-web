import { z } from "zod";

/**
 * A Loop's name and description, the same wherever they are typed.
 *
 * One definition for the create form and the panel that edits them later, so
 * a name the one accepts is never refused by the other.
 *
 * The server allows a 120-character name; 50 is the app's own, tighter rule.
 * The description's 280 is the server's column (`Conversation.description`),
 * not a choice made here - anything longer is refused there.
 */
export const GROUP_DESCRIPTION_MAX = 280;

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Loop name is required")
  .min(3, "Loop name must be at least 3 characters")
  .max(50, "Loop name must be 50 characters or less");

export const groupDescriptionSchema = z
  .string()
  .trim()
  .max(
    GROUP_DESCRIPTION_MAX,
    `Description must be ${GROUP_DESCRIPTION_MAX} characters or less`,
  );
