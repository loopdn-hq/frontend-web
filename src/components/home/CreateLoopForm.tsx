"use client";

import Image from "next/image";
import { useState, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LoadingSpinner } from "@/components/auth/LoadingSpinner";
import {
  createConversation,
  type BroadcastReplyMode,
  type CommunicationMode,
  type CreateConversationPayload,
  type JoiningMethod,
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
    .max(500, "Description must be 500 characters or less"),
  joining_method: z.enum(["open", "code", "admin_approval", "invite_only"]),
  communication_mode: z.enum(["chat", "broadcast"]),
  broadcast_reply_mode: z.enum(["private", "group_wide", "disabled"]),
  image: z.custom<File>().optional(),
});

type CreateLoopFormValues = z.infer<typeof createLoopSchema>;

type CreateLoopFormProps = {
  onClose: () => void;
  onSuccess?: (loopData: CreateConversationPayload) => void;
};

const joiningMethods: Array<{
  value: JoiningMethod;
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
    value: "admin_approval",
    label: "Admin Approval",
    description: "Members request access; admin approves",
  },
  {
    value: "invite_only",
    label: "Invite Only",
    description: "Only invited members can join",
  },
];

const communicationModes: Array<{
  value: CommunicationMode;
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

const broadcastReplyModes: Array<{
  value: BroadcastReplyMode;
  label: string;
  description: string;
}> = [
  {
    value: "private",
    label: "Private Replies",
    description: "Members can only reply privately to admins",
  },
  {
    value: "group_wide",
    label: "Group-Wide Replies",
    description: "Members can reply to everyone in the group",
  },
  {
    value: "disabled",
    label: "No Replies",
    description: "Members cannot reply; receive announcements only",
  },
];

export function CreateLoopForm({ onClose, onSuccess }: CreateLoopFormProps) {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateLoopFormValues>({
    resolver: zodResolver(createLoopSchema),
    defaultValues: {
      name: "",
      description: "",
      joining_method: "open",
      communication_mode: "chat",
      broadcast_reply_mode: "private",
    },
  });

  const communicationMode = useWatch({ control, name: "communication_mode" });
  const imageField = register("image", { onChange: handleImageSelect });

  function handleImageSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("image", { message: "Please select an image file" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("image", { message: "Image size must be less than 5MB" });
        return;
      }
      setImage(file);
      setValue("image", file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      clearErrors("image");
    }
  }

  async function onSubmit(values: CreateLoopFormValues) {
    try {
      const payload: CreateConversationPayload = {
        name: values.name,
        description: values.description,
        joining_method: values.joining_method,
        communication_mode: values.communication_mode,
        broadcast_reply_mode:
          values.communication_mode === "broadcast"
            ? values.broadcast_reply_mode
            : undefined,
        image: image ?? undefined,
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
      <div>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">
            Loop Name *
          </span>
          <input
            type="text"
            placeholder="e.g., Family HQ, Neighborhood Watch"
            {...register("name")}
            disabled={isSubmitting}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 dark:text-slate-200 dark:bg-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          />
        </label>
        {errors.name && (
          <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">
            Description
          </span>
          <textarea
            placeholder="What is this Loop about? (optional)"
            {...register("description")}
            disabled={isSubmitting}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 dark:text-slate-200 dark:bg-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          />
        </label>
      </div>

      {/* Image Upload */}
      <div>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">
            Loop Image
          </span>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 transition hover:border-sky-400 hover:bg-sky-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {imagePreview ? (
              <>
                <Image
                  src={imagePreview}
                  alt="Preview"
                  width={80}
                  height={80}
                  className="mb-3 h-20 w-20 rounded-lg object-cover"
                />
                <p className="text-xs text-slate-600">Click to change image</p>
              </>
            ) : (
              <>
                <svg
                  className="mb-2 h-8 w-8 text-slate-400 dark:text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Upload an image
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  PNG, JPG up to 5MB
                </p>
              </>
            )}
          </div>
          <input
            {...imageField}
            ref={(element) => {
              imageField.ref(element);
              fileInputRef.current = element;
            }}
            type="file"
            accept="image/*"
            disabled={isSubmitting}
            className="hidden"
          />
        </label>
        {errors.image && (
          <p className="mt-1 text-xs text-rose-600">{errors.image.message}</p>
        )}
      </div>

      {/* Joining Method */}
      <div>
        <label className="block">
          <span className="mb-3 block text-sm font-semibold text-slate-900 dark:text-slate-100">
            Who can join? *
          </span>
          <div className="space-y-2">
            {joiningMethods.map((method) => (
              <label
                key={method.value}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-sky-300 hover:bg-sky-50"
              >
                <input
                  type="radio"
                  {...register("joining_method")}
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
                  {...register("communication_mode")}
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

      {/* Broadcast Reply Mode (conditional) */}
      {communicationMode === "broadcast" && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 dark:bg-sky-950/40 p-4">
          <label className="block">
            <span className="mb-3 block text-sm font-semibold text-slate-900 dark:text-slate-100">
              How can members reply? *
            </span>
            <div className="space-y-2">
              {broadcastReplyModes.map((mode) => (
                <label
                  key={mode.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-sky-200 bg-white dark:bg-slate-900 p-3 transition hover:border-sky-400 hover:bg-sky-50"
                >
                  <input
                    type="radio"
                    {...register("broadcast_reply_mode")}
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
      )}

      {/* Error Message */}
      {errors.root?.server && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errors.root.server.message}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 border-t border-slate-200 pt-6">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-xl bg-[linear-gradient(130deg,#00a6ff_0%,#1f7fe6_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,143,223,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? <LoadingSpinner /> : "Create Loop"}
        </button>
      </div>
    </form>
  );
}
