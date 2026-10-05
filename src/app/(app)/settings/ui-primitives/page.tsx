"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, Info } from "lucide-react";
import {
  Alert,
  Button,
  Checkbox,
  ContextMenu,
  type ContextMenuOrigin,
  Field,
  Input,
  Modal,
  RadioGroup,
  Select,
  Switch,
  Tabs,
  Textarea,
} from "@/components/ui";
import { PalettePreview } from "./PalettePreview";

type DemoTab = "forms" | "actions" | "feedback" | "colours";

export default function UiPrimitivesPage() {
  const [menuOrigin, setMenuOrigin] = useState<ContextMenuOrigin | null>(null);
  const [tab, setTab] = useState<DemoTab>("forms");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChecked, setIsChecked] = useState(true);
  const [isSwitchOn, setIsSwitchOn] = useState(true);
  const [radioValue, setRadioValue] = useState("chat");
  const [selectValue, setSelectValue] = useState("admins");

  return (
    <div className="h-full overflow-y-auto bg-[linear-gradient(160deg,#e4f4ff_0%,#f8fbff_50%,#f3f8ff_100%)] p-4 dark:bg-[linear-gradient(160deg,#0b1220_0%,#0e1626_50%,#0b1220_100%)] sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600 dark:text-sky-400">
            Design System
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            UI Primitive Preview
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Visual sandbox for shared controls used across auth, settings, and
            admin surfaces.
          </p>
          <Link
            href="/settings/"
            className="mt-3 inline-block text-xs text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Back to settings
          </Link>
        </header>

        <Tabs<DemoTab>
          value={tab}
          onChange={setTab}
          items={[
            { value: "forms", label: "Form Controls" },
            { value: "actions", label: "Actions" },
            { value: "feedback", label: "Feedback" },
            { value: "colours", label: "Colours" },
          ]}
        />

        {tab === "forms" && (
          <section className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Input and Textarea
              </h2>
              <Field label="Default input" htmlFor="demo-default-input">
                <Input id="demo-default-input" placeholder="Type here..." />
              </Field>
              <Field
                label="Input with error"
                htmlFor="demo-error-input"
                error="This field is required"
              >
                <Input
                  id="demo-error-input"
                  placeholder="Missing value"
                  state="error"
                />
              </Field>
              <Field label="Textarea" htmlFor="demo-textarea">
                <Textarea
                  id="demo-textarea"
                  rows={4}
                  placeholder="Longer text content..."
                />
              </Field>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Select, Checkbox, Switch, Radio
              </h2>
              <Field label="Select" htmlFor="demo-select">
                <Select
                  id="demo-select"
                  value={selectValue}
                  onChange={(event) => setSelectValue(event.target.value)}
                  options={[
                    { value: "members", label: "Members" },
                    { value: "admins", label: "Admins" },
                  ]}
                />
              </Field>
              <Checkbox
                checked={isChecked}
                onChange={(event) => setIsChecked(event.target.checked)}
                label="Enable notifications"
                description="Send push and in-app alerts"
              />
              <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Switch - takes effect when flipped
                </span>
                <Switch checked={isSwitchOn} onCheckedChange={setIsSwitchOn} />
              </label>
              <RadioGroup
                name="demo-mode"
                value={radioValue}
                onChange={setRadioValue}
                options={[
                  {
                    value: "chat",
                    label: "Chat",
                    description: "Everyone can post",
                  },
                  {
                    value: "broadcast",
                    label: "Broadcast",
                    description: "Admins post announcements",
                  },
                ]}
              />
            </div>
          </section>
        )}

        {tab === "actions" && (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Buttons and Modal
            </h2>
            <div className="flex flex-wrap gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button size="sm">Small</Button>
              <Button size="lg">Large</Button>
              <Button onClick={() => setIsModalOpen(true)}>Open Modal</Button>
            </div>

            <Modal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              title="Demo Modal"
              description="Reusable dialog primitive with consistent header and actions."
              closeLabel="Close demo modal"
              footer={
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setIsModalOpen(false)}
                    fullWidth
                  >
                    Cancel
                  </Button>
                  <Button onClick={() => setIsModalOpen(false)} fullWidth>
                    Confirm
                  </Button>
                </div>
              }
            >
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This modal uses the same primitive used by app flows such as add
                members and leave confirmation.
              </p>
            </Modal>
          </section>
        )}

        {tab === "colours" && <PalettePreview />}

        {tab === "feedback" && (
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Alerts
            </h2>
            <Alert variant="neutral">Neutral status message</Alert>
            <Alert variant="info">Informational update for the user</Alert>
            <Alert variant="success">Success state after saving changes</Alert>
            <Alert variant="error">Error state when a request fails</Alert>
          </section>
        )}

        {tab === "actions" && (
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Context menu
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Anchored to the pointer rather than to a trigger, portalled so a
              scroll container cannot clip it, and clamped inside the viewport.
              Closes on Escape, on a click outside, on scroll and on resize.
            </p>
            <div
              onContextMenu={(event) => {
                event.preventDefault();
                setMenuOrigin({ x: event.clientX, y: event.clientY });
              }}
              className="flex h-28 cursor-context-menu items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400"
            >
              Right-click anywhere in this box
            </div>
            <ContextMenu
              origin={menuOrigin}
              onClose={() => setMenuOrigin(null)}
              label="Demo actions"
              items={[
                {
                  id: "copy",
                  label: "Copy",
                  icon: <Copy className="h-4 w-4" />,
                  onSelect: () => {},
                },
                {
                  id: "info",
                  label: "Details",
                  icon: <Info className="h-4 w-4" />,
                  onSelect: () => {},
                },
                { kind: "separator", id: "sep" },
                {
                  id: "danger",
                  label: "Destructive action",
                  tone: "danger",
                  onSelect: () => {},
                },
              ]}
            />
          </section>
        )}
      </div>
    </div>
  );
}
