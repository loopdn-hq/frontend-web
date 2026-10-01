"use client";

import { CreateLoopForm } from "./CreateLoopForm";
import { Modal } from "@/components/ui";

type CreateLoopModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (conversationId: string | number | null) => void;
};

export function CreateLoopModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateLoopModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create a Loop"
      description="Set up a new group for your community"
      maxWidthClassName="max-w-2xl"
      bodyClassName="max-h-[calc(100vh-200px)] overflow-y-auto px-6 py-6"
      closeLabel="Close create loop modal"
    >
      <CreateLoopForm onClose={onClose} onSuccess={onSuccess} />
    </Modal>
  );
}
