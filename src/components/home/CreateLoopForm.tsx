"use client";

import { useState, useRef } from "react";
import { LoadingSpinner } from "@/components/auth/LoadingSpinner";

type JoiningMethod = "open" | "code" | "admin_approval" | "invite_only";
type CommunicationMode = "chat" | "broadcast";
type BroadcastReplyMode = "private" | "group_wide" | "disabled";

type CreateLoopFormProps = {
  onClose: () => void;
  onSuccess?: (loopData: { name: string; description: string; joining_method: JoiningMethod; communication_mode: CommunicationMode; broadcast_reply_mode?: BroadcastReplyMode }) => void;
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
  const [loopName, setLoopName] = useState("");
  const [description, setDescription] = useState("");
  const [joiningMethod, setJoiningMethod] = useState<JoiningMethod>("open");
  const [communicationMode, setCommunicationMode] = useState<CommunicationMode>("chat");
  const [broadcastReplyMode, setBroadcastReplyMode] = useState<BroadcastReplyMode>("private");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setErrors({ ...errors, image: "Please select an image file" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrors({ ...errors, image: "Image size must be less than 5MB" });
        return;
      }
      setImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setErrors({ ...errors, image: "" });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!loopName.trim()) newErrors.loopName = "Loop name is required";
    if (loopName.trim().length < 3) newErrors.loopName = "Loop name must be at least 3 characters";
    if (loopName.trim().length > 50) newErrors.loopName = "Loop name must be 50 characters or less";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // For now, we'll prepare the data for Django backend
      // Once connected, this will send to the backend
      const formData = new FormData();
      formData.append("name", loopName);
      formData.append("description", description);
      formData.append("joining_method", joiningMethod);
      formData.append("communication_mode", communicationMode);
      if (communicationMode === "broadcast") {
        formData.append("broadcast_reply_mode", broadcastReplyMode);
      }
      if (image) {
        formData.append("image", image);
      }

      // Placeholder for backend integration
      console.log("Loop creation data ready:", {
        name: loopName,
        description,
        joining_method: joiningMethod,
        communication_mode: communicationMode,
        broadcast_reply_mode: communicationMode === "broadcast" ? broadcastReplyMode : null,
        image: image ? image.name : null,
      });

      // Simulated API call - will be replaced with actual Django endpoint
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Success - pass loop data to parent
      onSuccess?.({
        name: loopName,
        description,
        joining_method: joiningMethod,
        communication_mode: communicationMode,
        broadcast_reply_mode: communicationMode === "broadcast" ? broadcastReplyMode : undefined,
      });
      onClose();
    } catch (error) {
      console.error("Error creating loop:", error);
      setErrors({ submit: "Failed to create loop. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Loop Name */}
      <div>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">Loop Name *</span>
          <input
            type="text"
            placeholder="e.g., Family HQ, Neighborhood Watch"
            value={loopName}
            onChange={(e) => setLoopName(e.target.value)}
            disabled={isSubmitting}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 dark:text-slate-200 dark:bg-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          />
        </label>
        {errors.loopName && <p className="mt-1 text-xs text-rose-600">{errors.loopName}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">Description</span>
          <textarea
            placeholder="What is this Loop about? (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 dark:text-slate-200 dark:bg-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          />
        </label>
      </div>

      {/* Image Upload */}
      <div>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">Loop Image</span>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 transition hover:border-sky-400 hover:bg-sky-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="Preview" className="mb-3 h-20 w-20 rounded-lg object-cover" />
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
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Upload an image</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPG up to 5MB</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            disabled={isSubmitting}
            className="hidden"
          />
        </label>
        {errors.image && <p className="mt-1 text-xs text-rose-600">{errors.image}</p>}
      </div>

      {/* Joining Method */}
      <div>
        <label className="block">
          <span className="mb-3 block text-sm font-semibold text-slate-900 dark:text-slate-100">Who can join? *</span>
          <div className="space-y-2">
            {joiningMethods.map((method) => (
              <label key={method.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-sky-300 hover:bg-sky-50">
                <input
                  type="radio"
                  name="joiningMethod"
                  value={method.value}
                  checked={joiningMethod === method.value}
                  onChange={() => setJoiningMethod(method.value)}
                  disabled={isSubmitting}
                  className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
                />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{method.label}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{method.description}</p>
                </div>
              </label>
            ))}
          </div>
        </label>
      </div>

      {/* Communication Mode */}
      <div>
        <label className="block">
          <span className="mb-3 block text-sm font-semibold text-slate-900 dark:text-slate-100">Communication Mode *</span>
          <div className="space-y-2">
            {communicationModes.map((mode) => (
              <label key={mode.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-sky-300 hover:bg-sky-50">
                <input
                  type="radio"
                  name="communicationMode"
                  value={mode.value}
                  checked={communicationMode === mode.value}
                  onChange={() => setCommunicationMode(mode.value)}
                  disabled={isSubmitting}
                  className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
                />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{mode.label}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{mode.description}</p>
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
            <span className="mb-3 block text-sm font-semibold text-slate-900 dark:text-slate-100">How can members reply? *</span>
            <div className="space-y-2">
              {broadcastReplyModes.map((mode) => (
                <label key={mode.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-sky-200 bg-white dark:bg-slate-900 p-3 transition hover:border-sky-400 hover:bg-sky-50">
                  <input
                    type="radio"
                    name="broadcastReplyMode"
                    value={mode.value}
                    checked={broadcastReplyMode === mode.value}
                    onChange={() => setBroadcastReplyMode(mode.value)}
                    disabled={isSubmitting}
                    className="mt-1 h-4 w-4 cursor-pointer accent-sky-600"
                  />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{mode.label}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{mode.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </label>
        </div>
      )}

      {/* Error Message */}
      {errors.submit && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.submit}</div>
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
