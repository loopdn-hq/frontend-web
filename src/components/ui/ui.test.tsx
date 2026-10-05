import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Alert,
  Badge,
  Button,
  Checkbox,
  ContextMenu,
  Field,
  Input,
  InternationalPhoneInput,
  Modal,
  RadioGroup,
  Select,
  Skeleton,
  SkeletonRegion,
  Switch,
  Tabs,
  Textarea,
  ToastProvider,
  useToast,
  type ContextMenuItem,
} from "@/components/ui";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Alert and Badge", () => {
  it("colour an alert by variant, neutral by default", () => {
    render(
      <>
        <Alert>Plain</Alert>
        <Alert variant="error" className="mt-2">
          Broken
        </Alert>
      </>,
    );
    expect(screen.getByText("Plain")).toHaveClass("bg-slate-100");
    expect(screen.getByText("Broken")).toHaveClass("bg-rose-50", "mt-2");
  });

  it("colour a badge by tone", () => {
    render(
      <>
        <Badge>Draft</Badge>
        <Badge tone="success">Running</Badge>
      </>,
    );
    expect(screen.getByText("Draft")).toHaveClass("bg-slate-100");
    expect(screen.getByText("Running")).toHaveClass("bg-emerald-100");
  });
});

describe("Button", () => {
  it("is a plain button unless told to submit", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <>
        <Button ref={ref}>Save</Button>
        <Button type="submit" variant="danger" size="sm" fullWidth>
          Delete
        </Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "type",
      "button",
    );
    expect(ref.current).toBe(screen.getByRole("button", { name: "Save" }));
    const danger = screen.getByRole("button", { name: "Delete" });
    expect(danger).toHaveAttribute("type", "submit");
    expect(danger).toHaveClass("bg-rose-600", "min-h-9", "w-full");
  });

  it("does nothing when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Checkbox", () => {
  it("is a bare input without a label", () => {
    const { container } = render(<Checkbox aria-label="Agree" />);
    expect(container.querySelector("label")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Agree" })).toBeInTheDocument();
  });

  it("wraps itself in its label and description, so both are clickable", async () => {
    const onChange = vi.fn();
    render(
      <Checkbox
        label="Press Enter to send"
        description="Otherwise Ctrl+Enter."
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByText("Otherwise Ctrl+Enter."));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("checkbox", { name: /press enter to send/i }),
    ).toBeChecked();
  });

  it("shows a description alone, and dims when disabled", () => {
    render(<Checkbox description="Only a description" disabled />);
    const label = screen.getByText("Only a description").closest("label");
    expect(label).toHaveClass("cursor-not-allowed");
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});

describe("Field", () => {
  it("ties its label to the control and shows the hint and the error", () => {
    render(
      <Field label="Email" htmlFor="email" hint="We never share it." error="Required.">
        <Input id="email" state="error" uppercaseTracking />
      </Field>,
    );
    expect(screen.getByLabelText("Email")).toHaveClass("border-rose-300", "uppercase");
    expect(screen.getByText("We never share it.")).toBeInTheDocument();
    expect(screen.getByText("Required.")).toHaveClass("text-rose-600");
  });

  it("renders just the control when given nothing else", () => {
    const { container } = render(
      <Field>
        <Textarea aria-label="Notes" state="error" />
      </Field>,
    );
    expect(container.querySelector("label")).toBeNull();
    expect(container.querySelectorAll("p")).toHaveLength(0);
    expect(screen.getByLabelText("Notes")).toHaveClass("border-rose-300");
  });
});

describe("Select", () => {
  const options = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta", disabled: true },
  ];

  it("offers its options, with a placeholder nobody can pick back", async () => {
    const onChange = vi.fn();
    render(
      <Select
        aria-label="Letter"
        options={options}
        placeholder="Choose one"
        defaultValue=""
        onChange={onChange}
        state="error"
      />,
    );
    const select = screen.getByLabelText("Letter");
    expect(select).toHaveClass("border-rose-300");
    expect(screen.getByRole("option", { name: "Choose one" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Beta" })).toBeDisabled();

    await userEvent.selectOptions(select, "a");
    expect(onChange).toHaveBeenCalled();
    expect(select).toHaveValue("a");
  });

  it("has no placeholder option unless asked", () => {
    render(<Select aria-label="Letter" options={options} value="a" onChange={() => {}} />);
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });
});

describe("Skeleton", () => {
  it("is hidden from assistive tech, inside a region that says what is loading", () => {
    render(
      <SkeletonRegion label="Loading members" className="space-y-2">
        <Skeleton className="h-4" />
      </SkeletonRegion>,
    );
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region).toHaveTextContent("Loading members");
    expect(region.querySelector("[aria-hidden]")).toHaveClass("h-4");
  });
});

describe("Switch", () => {
  it("reports the opposite of where it is", async () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(
      <Switch checked={false} onCheckedChange={onCheckedChange} aria-label="Sound" />,
    );
    const toggle = screen.getByRole("switch", { name: "Sound" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);
    expect(onCheckedChange).toHaveBeenCalledWith(true);

    rerender(<Switch checked onCheckedChange={onCheckedChange} aria-label="Sound" />);
    await userEvent.click(toggle);
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it("lets a click handler veto the change", async () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch
        checked={false}
        onCheckedChange={onCheckedChange}
        onClick={(event) => event.preventDefault()}
        aria-label="Sound"
      />,
    );
    await userEvent.click(screen.getByRole("switch"));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});

describe("Tabs", () => {
  it("marks the current tab and reports a change, skipping disabled ones", async () => {
    const onChange = vi.fn();
    render(
      <Tabs
        value="one"
        onChange={onChange}
        items={[
          { value: "one", label: "One" },
          { value: "two", label: "Two" },
          { value: "three", label: "Three", disabled: true },
        ]}
      />,
    );
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.click(screen.getByRole("tab", { name: "Two" }));
    expect(onChange).toHaveBeenCalledWith("two");

    await userEvent.click(screen.getByRole("tab", { name: "Three" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("RadioGroup", () => {
  const options = [
    { value: "everyone", label: "Everyone", description: "Anybody at all." },
    { value: "nobody", label: "Nobody" },
    { value: "later", label: "Later", disabled: true },
  ];

  it("checks the current option and reports another being picked", async () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        name="audience"
        value="everyone"
        options={options}
        onChange={onChange}
        aria-labelledby="heading"
      />,
    );
    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "aria-labelledby",
      "heading",
    );
    expect(screen.getByRole("radio", { name: /everyone/i })).toBeChecked();
    expect(screen.getByText("Anybody at all.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Later" })).toBeDisabled();

    await userEvent.click(screen.getByRole("radio", { name: "Nobody" }));
    expect(onChange).toHaveBeenCalledWith("nobody");
  });

  it("disables every option at once, in either layout and style", () => {
    const { rerender } = render(
      <RadioGroup
        name="audience"
        value="nobody"
        options={options}
        onChange={() => {}}
        disabled
        orientation="horizontal"
        variant="plain"
      />,
    );
    expect(screen.getByRole("radiogroup")).toHaveClass("grid");
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();

    rerender(
      <RadioGroup
        name="audience"
        value="nobody"
        options={options}
        onChange={() => {}}
        variant="plain"
      />,
    );
    expect(screen.getByRole("radiogroup")).toHaveClass("space-y-0.5");
  });
});

describe("Modal", () => {
  function Harness({ onClose = () => {} }: { onClose?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <Modal
          isOpen={open}
          onClose={() => {
            onClose();
            setOpen(false);
          }}
          title="Leave this Loop?"
          description="You can rejoin later."
          footer={<button>Leave</button>}
          closeLabel="Never mind"
        >
          <input aria-label="Reason" />
        </Modal>
      </>
    );
  }

  it("renders nothing while closed", () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a labelled dialog that takes focus and locks the page behind it", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText("Open"));

    const dialog = screen.getByRole("dialog", { name: "Leave this Loop?" });
    expect(dialog).toHaveAccessibleDescription("You can rejoin later.");
    expect(dialog).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    expect(within(dialog).getByRole("button", { name: "Leave" })).toBeInTheDocument();
  });

  it("closes from its button, the backdrop and Escape - and gives focus back", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByText("Open");

    await userEvent.click(opener);
    await userEvent.click(screen.getByRole("button", { name: "Never mind" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe("");

    await userEvent.click(opener);
    await userEvent.click(screen.getByRole("presentation"));
    expect(onClose).toHaveBeenCalledTimes(2);

    await userEvent.click(opener);
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("does not close when the dialog itself is clicked", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByText("Open"));
    await userEvent.click(screen.getByLabelText("Reason"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("lets Escape close only the modal on top", async () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    render(
      <>
        <Modal isOpen onClose={closeOuter} title="Outer">
          outer
        </Modal>
        <Modal isOpen onClose={closeInner} title="Inner" maxWidthClassName="max-w-xl">
          inner
        </Modal>
      </>,
    );
    expect(screen.getByRole("dialog", { name: "Inner" })).toHaveClass("max-w-xl");
    expect(screen.getByRole("dialog", { name: "Outer" })).not.toHaveAttribute(
      "aria-describedby",
    );

    await userEvent.keyboard("{Escape}");
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
  });

  it("leaves focus alone when something inside already has it", () => {
    function AutoFocus() {
      return (
        <Modal isOpen onClose={() => {}} title="Rename">
          <input aria-label="Name" autoFocus />
        </Modal>
      );
    }
    render(<AutoFocus />);
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });
});

describe("ToastProvider", () => {
  function Trigger({ toast }: { toast: Parameters<ReturnType<typeof useToast>>[0] }) {
    const show = useToast();
    return <button onClick={() => show(toast)}>Show</button>;
  }

  it("shows a toast, then takes it away by itself", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger toast={{ title: "Saved", description: "Your changes are in." }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("Show"));
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("Saved");
    expect(toast).toHaveTextContent("Your changes are in.");

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("can be dismissed early, and stacks no more than three", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger toast={{ title: "Failed", tone: "error" }} />
      </ToastProvider>,
    );
    for (let i = 0; i < 5; i += 1) fireEvent.click(screen.getByText("Show"));
    expect(screen.getAllByRole("status")).toHaveLength(3);

    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);
    expect(screen.getAllByRole("status")).toHaveLength(2);
  });

  it("refuses to be used outside its provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Trigger toast={{ title: "x", tone: "info" }} />)).toThrow(
      "useToast() must be used under ToastProvider.",
    );
  });
});

describe("InternationalPhoneInput", () => {
  it("reports the number in international form, and empty as an empty string", async () => {
    const onChange = vi.fn();
    function Controlled() {
      const [value, setValue] = useState("");
      return (
        <InternationalPhoneInput
          id="phone"
          name="phone"
          placeholder="Phone number"
          value={value}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
        />
      );
    }
    render(<Controlled />);
    const input = screen.getByPlaceholderText("Phone number");
    expect(input).toHaveAttribute("id", "phone");

    await userEvent.type(input, "4155552671");
    expect(onChange).toHaveBeenLastCalledWith("+14155552671");

    await userEvent.clear(input);
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("can be disabled, and start from another country", () => {
    render(
      <InternationalPhoneInput
        value="+639171234567"
        onChange={() => {}}
        defaultCountry="PH"
        placeholder="Phone number"
        disabled
      />,
    );
    expect(screen.getByPlaceholderText("Phone number")).toBeDisabled();
  });
});

describe("ContextMenu", () => {
  function items(onSelect = vi.fn()): ContextMenuItem[] {
    return [
      { id: "reply", label: "Reply", icon: <svg />, onSelect },
      { id: "copy", label: "Copy", description: "Copy the text", onSelect },
      { kind: "separator", id: "sep" },
      { id: "pin", label: "Pin", disabled: true, onSelect },
      {
        id: "delete",
        label: "Delete",
        description: "For everyone",
        tone: "danger",
        onSelect,
      },
    ];
  }

  function sizeOf(width: number, height: number) {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  }

  it("renders nothing without somewhere to open", () => {
    render(<ContextMenu origin={null} items={items()} onClose={() => {}} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens where the pointer was, focused on the first item", () => {
    sizeOf(200, 100);
    render(
      <ContextMenu
        origin={{ x: 40, y: 60 }}
        items={items()}
        onClose={() => {}}
        label="Account"
        header={<div>Signed in as sam</div>}
      />,
    );
    const menu = screen.getByRole("menu", { name: "Account" });
    expect(menu).toHaveStyle({ left: "40px", top: "60px" });
    expect(menu).toHaveClass("opacity-100");
    expect(menu).toHaveTextContent("Signed in as sam");
    expect(screen.getByRole("menuitem", { name: "Reply" })).toHaveFocus();
    expect(screen.getByRole("separator")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /delete/i })).toHaveClass(
      "text-rose-600",
    );
  });

  it("flips to the other side of the pointer near the window's edge", () => {
    sizeOf(200, 100);
    render(
      <ContextMenu
        origin={{ x: window.innerWidth - 10, y: window.innerHeight - 10 }}
        items={items()}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("menu", { name: "Message actions" })).toHaveStyle({
      left: `${window.innerWidth - 210}px`,
      top: `${window.innerHeight - 110}px`,
    });
  });

  it("never flips off the opposite edge", () => {
    sizeOf(5000, 5000);
    render(
      <ContextMenu origin={{ x: 100, y: 100 }} items={items()} onClose={() => {}} />,
    );
    expect(screen.getByRole("menu")).toHaveStyle({ left: "8px", top: "8px" });
  });

  it("runs the item and closes", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <ContextMenu origin={{ x: 1, y: 1 }} items={items(onSelect)} onClose={onClose} />,
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /copy/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("menuitem", { name: "Pin" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("walks the enabled items with the arrow keys, wrapping at both ends", async () => {
    render(<ContextMenu origin={{ x: 1, y: 1 }} items={items()} onClose={() => {}} />);
    const reply = screen.getByRole("menuitem", { name: "Reply" });
    const copy = screen.getByRole("menuitem", { name: /copy/i });
    const remove = screen.getByRole("menuitem", { name: /delete/i });

    await userEvent.keyboard("{ArrowDown}");
    expect(copy).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(remove).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(reply).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(remove).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(reply).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(remove).toHaveFocus();
    await userEvent.keyboard("a");
    expect(remove).toHaveFocus();
  });

  it("ignores the arrow keys when there is nothing to walk", () => {
    render(
      <ContextMenu
        origin={{ x: 1, y: 1 }}
        items={[{ kind: "separator", id: "only" }]}
        onClose={() => {}}
      />,
    );
    expect(() =>
      fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" }),
    ).not.toThrow();
  });

  it("closes on Escape, a press outside, a scroll and a resize", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ContextMenu origin={{ x: 1, y: 1 }} items={items()} onClose={onClose} />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("resize"));
    expect(onClose).toHaveBeenCalledTimes(4);

    rerender(<ContextMenu origin={null} items={items()} onClose={onClose} />);
    window.dispatchEvent(new Event("resize"));
    expect(onClose).toHaveBeenCalledTimes(4);
  });
});
