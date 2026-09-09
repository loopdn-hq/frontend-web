"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LoadingSpinner } from "@/components/auth/LoadingSpinner";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import {
  MembersField,
  commitPendingMember,
} from "@/components/home/MembersField";
import { toMemberPayload, type MemberEntry } from "@/lib/chat/members";
import {
  createConversation,
  type ConversationMode,
  type CreateConversationPayload,
  type GroupMemberPermission,
  type JoinMode,
} from "@/lib/chat/conversations";

const createLoopSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Loop name is required")
    .min(3, "Loop name must be at least 3 characters")
    .max(50, "Loop name must be 50 characters or less"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less")
    .optional(),
  join_mode: z.enum(["open", "code", "approval", "invite"]),
  mode: z.enum(["chat", "broadcast"]),
  add_member_permission: z.enum(["members", "admins"]),
  edit_group_permission: z.enum(["members", "admins"]),
  sms_delivery_enabled: z.boolean(),
  sms_replies_enabled: z.boolean(),
  voice_messages_enabled: z.boolean(),
});

type CreateLoopFormValues = z.infer<typeof createLoopSchema>;

type CreateLoopFormProps = {
  onClose: () => void;
  onSuccess?: (loopData: CreateConversationPayload) => void;
};

const joinModes: Array<{
  value: JoinMode;
  label: string;
  description: string;
}> = [
  {
    value: "open",
    label: "Open",
    description: "Anyone with the link can join",
  },
  {
    value: "code",
    label: "Code Required",
    description: "Members need a code to join",
  },
  {
    value: "approval",
    label: "Admin Approval",
    description: "Members request access; admin approves",
  },
  {
    value: "invite",
    label: "Invite Only",
    description: "Only invited members can join",
  },
];

const communicationModes: Array<{
  value: ConversationMode;
  label: string;
  description: string;
}> = [
  {
    value: "chat",
    label: "Chat Group",
    description: "Members communicate with everyone according to permissions",
  },
  {
    value: "broadcast",
    label: "Broadcast Group",
    description: "Admins send announcements; member replies based on settings",
  },
];

const memberPermissions: Array<{
  value: GroupMemberPermission;
  label: string;
}> = [
  { value: "members", label: "Everyone" },
  { value: "admins", label: "Admins Only" },
];

export function CreateLoopForm({ onClose, onSuccess }: CreateLoopFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateLoopFormValues>({
    resolver: zodResolver(createLoopSchema),
    defaultValues: {
      name: "",
      description: "",
      join_mode: "open",
      mode: "chat",
      add_member_permission: "admins",
      edit_group_permission: "admins",
      sms_delivery_enabled: true,
      sms_replies_enabled: true,
      voice_messages_enabled: true,
    },
  });

  // Kept outside react-hook-form: these are parsed objects rather than a
  // string, and the field owns its own per-entry validation.
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [pendingMember, setPendingMember] = useState("");

  async function onSubmit(values: CreateLoopFormValues) {
    // Whatever is still sitting in the box counts as typed, so fold it in
    // before deciding what to send.
    const pending = commitPendingMember(pendingMember, members);
    if (pending.error) {
      setError("root.server", { message: pending.error });
      return;
    }
    setMembers(pending.entries);
    setPendingMember("");

    const {
      members: accountMembers,
      invite,
      inviteEmail,
    } = toMemberPayload(pending.entries);

    try {
      const payload: CreateConversationPayload = {
        name: values.name,
        description: values.description,
        ...(accountMembers.length > 0 ? { members: accountMembers } : {}),
        ...(invite.length > 0 ? { invite } : {}),
        ...(inviteEmail.length > 0 ? { invite_email: inviteEmail } : {}),
        settings: {
          mode: values.mode,
          join_mode: values.join_mode,
          add_member_permission: values.add_member_permission,
          edit_group_permission: values.edit_group_permission,
          sms_delivery_enabled: values.sms_delivery_enabled,
          sms_replies_enabled: values.sms_replies_enabled,
          voice_messages_enabled: values.voice_messages_enabled,
        },
      };
      const result = await createConversation(payload);
      if (!result.ok) {
        setError("root.server", { message: result.message });
        return;
      }
      onSuccess?.(payload);
      onClose();
    } catch {
      setError("root.server", {
        message: "Failed to create loop. Please try again.",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {/* Loop Name */}
      <Field
        label="Loop Name *"
        htmlFor="loop-name"
        error={errors.name?.message}
      >
        <Input
          id="loop-name"
          type="text"
          placeholder="e.g., Family HQ, Neighborhood Watch"
          {...register("name")}
          disabled={isSubmitting}
          state={errors.name ? "error" : "default"}
        />
      </Field>

      {/* Description */}
      <Field label="Description" htmlFor="loop-description">
        <Textarea
          id="loop-description"
          placeholder="What is this Loop about? (optional)"
          {...register("description")}
          disabled={isSubmitting}
          rows={3}
        />
      </Field>

      {/* Members */}
      <MembersField
        value={members}
        onChange={setMembers}
        onPendingChange={setPendingMember}
        disabled={isSubmitting}
      />

      {/* Join Mode */}
      <div>
        <label className="block">
          <span className="mb-3 block text-sm font-semibold text-slate-900 dark:text-slate-100">
            Who can join? *
          </span>
          <div className="space-y-2">
            {joinModes.map((method) => (
              <label
                key={method.value}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-sky-300 hover:bg-sky-50"
              >
                <input
                  type="radio"
                  {...register("join_mode")}
                  value={method.value}
                  disabled={isSubmitting}
                  className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
                />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {method.label}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {method.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </label>
      </div>

      {/* Communication Mode */}
      <div>
        <label className="block">
          <span className="mb-3 block text-sm font-semibold text-slate-900 dark:text-slate-100">
            Communication Mode *
          </span>
          <div className="space-y-2">
            {communicationModes.map((mode) => (
              <label
                key={mode.value}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-sky-300 hover:bg-sky-50"
              >
                <input
                  type="radio"
                  {...register("mode")}
                  value={mode.value}
                  disabled={isSubmitting}
                  className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
                />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {mode.label}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {mode.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </label>
      </div>

      {/* Add Member Permission */}
      <div>
        <label className="block">
          <span className="mb-3 block text-sm font-semibold text-slate-900 dark:text-slate-100">
            Who can add members?
          </span>
          <div className="flex gap-2">
            {memberPermissions.map((permission) => (
              <label
                key={permission.value}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-medium transition hover:border-sky-300 hover:bg-sky-50"
              >
                <input
                  type="radio"
                  {...register("add_member_permission")}
                  value={permission.value}
                  disabled={isSubmitting}
                  className="h-4 w-4 cursor-pointer accent-sky-600"
                />
                {permission.label}
              </label>
            ))}
          </div>
        </label>
      </div>

      {/* Edit Group Permission */}
      <div>
        <label className="block">
          <span className="mb-3 block text-sm font-semibold text-slate-900 dark:text-slate-100">
            Who can edit group details?
          </span>
          <div className="flex gap-2">
            {memberPermissions.map((permission) => (
              <label
                key={permission.value}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-medium transition hover:border-sky-300 hover:bg-sky-50"
              >
                <input
                  type="radio"
                  {...register("edit_group_permission")}
                  value={permission.value}
                  disabled={isSubmitting}
                  className="h-4 w-4 cursor-pointer accent-sky-600"
                />
                {permission.label}
              </label>
            ))}
          </div>
        </label>
      </div>

      {/* Feature Toggles */}
      <div className="space-y-3">
        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
          Features
        </span>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-sky-300 hover:bg-sky-50">
          <input
            type="checkbox"
            {...register("sms_delivery_enabled")}
            disabled={isSubmitting}
            className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
          />
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">
              SMS Delivery
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Deliver messages to members via SMS
            </p>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-sky-300 hover:bg-sky-50">
          <input
            type="checkbox"
            {...register("sms_replies_enabled")}
            disabled={isSubmitting}
            className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
          />
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">
              SMS Replies
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Allow members to reply via SMS
            </p>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-sky-300 hover:bg-sky-50">
          <input
            type="checkbox"
            {...register("voice_messages_enabled")}
            disabled={isSubmitting}
            className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
          />
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">
              Voice Messages
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Allow members to send voice notes and recordings
            </p>
          </div>
        </label>
      </div>

      {/* Error Message */}
      {errors.root?.server && (
        <Alert variant="error" className="px-4 py-3">
          {errors.root.server.message}
        </Alert>
      )}

      {/* Actions */}
      <div className="flex gap-3 border-t border-slate-200 pt-6">
        <Button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          variant="secondary"
          fullWidth
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} fullWidth>
          {isSubmitting ? <LoadingSpinner /> : "Create Loop"}
        </Button>
      </div>
    </form>
  );
}
