import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ChartCard,
  ChartTooltip,
  niceCeiling,
  seriesColor,
  wholePercentages,
} from "@/components/charts/ChartCard";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { ShareBar } from "@/components/charts/ShareBar";

/** The rows of the data table every chart carries for people who cannot see it. */
function tableRows() {
  return within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.textContent);
}

describe("wholePercentages", () => {
  it("rounds shares so they always add up to exactly 100", () => {
    expect(wholePercentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(wholePercentages([2, 1])).toEqual([67, 33]);
    expect(wholePercentages([50, 50])).toEqual([50, 50]);
    expect(wholePercentages([1, 1, 1]).reduce((a, b) => a + b)).toBe(100);
  });

  it("is all zeros when there is nothing to share out", () => {
    expect(wholePercentages([0, 0])).toEqual([0, 0]);
    expect(wholePercentages([])).toEqual([]);
  });
});

describe("niceCeiling", () => {
  it("rounds an axis top up to 1, 2, 5 or 10 of its magnitude", () => {
    expect(niceCeiling(1)).toBe(1);
    expect(niceCeiling(17)).toBe(20);
    expect(niceCeiling(42)).toBe(50);
    expect(niceCeiling(73)).toBe(100);
    expect(niceCeiling(0.3)).toBeCloseTo(0.5);
  });

  it("is zero for nothing, a negative, or nonsense", () => {
    expect(niceCeiling(0)).toBe(0);
    expect(niceCeiling(-5)).toBe(0);
    expect(niceCeiling(Number.NaN)).toBe(0);
    expect(niceCeiling(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("ChartCard", () => {
  it("titles the chart and carries its numbers as a table", () => {
    render(
      <ChartCard
        title="Messages"
        subtitle="Last 30 days"
        table={{
          valueHeading: "Count",
          rows: [{ label: "Sent", value: "140" }],
        }}
      >
        <p>the chart</p>
      </ChartCard>,
    );
    expect(
      screen.getByRole("heading", { name: "Messages" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();
    expect(screen.getByText("the chart")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Count" }),
    ).toBeInTheDocument();
    expect(tableRows()).toEqual(["Sent140"]);
  });

  it("names a series colour by its token", () => {
    expect(seriesColor("series-2")).toBe("var(--viz-series-2)");
    render(
      <ChartTooltip
        label="Sent"
        value="140"
        tone="series-1"
        className="top-0"
      />,
    );
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("140");
    expect(tooltip).toHaveTextContent("Sent");
    expect(tooltip).toHaveClass("top-0");
  });
});

describe("ColumnChart", () => {
  const data = [
    { label: "Sent", value: 140, display: "140", tone: "series-1" as const },
    {
      label: "Received",
      value: 610,
      display: "610",
      tone: "series-2" as const,
    },
  ];

  it("draws a labelled column for each value against a rounded axis", () => {
    render(
      <ColumnChart title="Messages" data={data} emptyMessage="Nothing yet." />,
    );
    expect(screen.getByRole("img", { name: "Sent: 140" })).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Received: 610" }),
    ).toBeInTheDocument();
    // 610 rounds up to an axis of 1,000, with a tick at the half.
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(tableRows()).toEqual(["Sent140", "Received610"]);
    // Two colours, so a legend says which is which.
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("shows a tooltip for the column under the pointer or the keyboard", () => {
    render(
      <ColumnChart title="Messages" data={data} emptyMessage="Nothing yet." />,
    );
    const sent = screen.getByRole("img", { name: "Sent: 140" });

    fireEvent.pointerEnter(sent);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Sent");
    fireEvent.pointerLeave(sent);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(screen.getByRole("img", { name: "Received: 610" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Received");
    fireEvent.blur(screen.getByRole("img", { name: "Received: 610" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("needs no legend for one colour, and formats ticks as told", () => {
    render(
      <ColumnChart
        title="Spend"
        data={data.map((datum) => ({ ...datum, tone: "series-1" as const }))}
        formatTick={(value) => `$${value}`}
        emptyMessage="Nothing yet."
      />,
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByText("$1000")).toBeInTheDocument();
  });

  it("says there is nothing rather than drawing an empty axis", () => {
    render(
      <ColumnChart
        title="Messages"
        subtitle="Last 30 days"
        data={[{ ...data[0], value: 0, display: "0" }]}
        emptyMessage="Nothing yet."
      />,
    );
    expect(screen.getByText("Nothing yet.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(tableRows()).toEqual(["Sent0"]);
  });
});

describe("DonutChart", () => {
  const slices = [
    { label: "Groups", value: 9, tone: "series-1" as const },
    { label: "Direct", value: 3, tone: "series-2" as const },
    { label: "Archived", value: 0, tone: "series-1" as const },
  ];

  it("draws a slice per non-zero value, with the total in the middle", () => {
    render(
      <DonutChart
        title="Conversations"
        subtitle="By kind"
        unit="chats"
        slices={slices}
        emptyMessage="No conversations yet."
      />,
    );
    expect(
      screen.getByRole("img", {
        name: "Conversations: Groups 9 of 12, Direct 3 of 12",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Groups: 9 of 12 chats" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /archived/i }),
    ).not.toBeInTheDocument();
    // Once in the hole of the ring, once as the table's total.
    expect(screen.getAllByText("12")).toHaveLength(2);
    expect(tableRows()).toEqual([
      "Groups9 (75%)",
      "Direct3 (25%)",
      "Archived0 (0%)",
      "Total12",
    ]);
    // The legend still lists the empty slice, so nothing goes missing.
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("shows a tooltip for the slice under the pointer or the keyboard", () => {
    render(
      <DonutChart
        title="Conversations"
        unit="chats"
        slices={slices}
        emptyMessage="None."
      />,
    );
    const direct = screen.getByRole("img", { name: "Direct: 3 of 12 chats" });
    fireEvent.pointerEnter(direct);
    expect(screen.getByRole("tooltip")).toHaveTextContent("3 of 12");
    fireEvent.pointerLeave(direct);
    fireEvent.focus(direct);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Direct");
    fireEvent.blur(direct);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("says there is nothing rather than drawing an empty ring", () => {
    render(
      <DonutChart
        title="Conversations"
        unit="chats"
        slices={slices.map((slice) => ({ ...slice, value: 0 }))}
        emptyMessage="No conversations yet."
      />,
    );
    expect(screen.getByText("No conversations yet.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(tableRows()).toEqual(["Groups0", "Direct0", "Archived0", "Total0"]);
  });
});

describe("ShareBar", () => {
  const segments = [
    { label: "Admin of", value: 4, tone: "series-1" as const },
    { label: "Member of", value: 5, tone: "series-2" as const },
    { label: "Broadcast", value: 0, tone: "series-1" as const },
  ];

  it("splits one bar by share, and totals it in the subtitle", () => {
    render(
      <ShareBar
        title="Groups"
        unit="groups"
        segments={segments}
        emptyMessage="None."
      />,
    );
    expect(screen.getByText("9 groups in total")).toBeInTheDocument();
    const admin = screen.getByRole("img", { name: "Admin of: 4 of 9 groups" });
    expect(admin.style.width).toMatch(/^44\.4/);
    expect(
      screen.queryByRole("img", { name: /broadcast/i }),
    ).not.toBeInTheDocument();
    expect(tableRows()).toEqual([
      "Admin of4 (44%)",
      "Member of5 (56%)",
      "Broadcast0 (0%)",
      "Total9",
    ]);
  });

  it("shows a tooltip for the segment under the pointer or the keyboard", () => {
    render(
      <ShareBar
        title="Groups"
        unit="groups"
        segments={segments}
        emptyMessage="None."
      />,
    );
    const member = screen.getByRole("img", {
      name: "Member of: 5 of 9 groups",
    });
    fireEvent.pointerEnter(member);
    expect(screen.getByRole("tooltip")).toHaveTextContent("5 of 9");
    fireEvent.pointerLeave(member);
    fireEvent.focus(member);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Member of");
    fireEvent.blur(member);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("says there is nothing rather than drawing an empty bar", () => {
    render(
      <ShareBar
        title="Groups"
        unit="groups"
        segments={[{ ...segments[0], value: 0 }]}
        emptyMessage="You are in no groups."
      />,
    );
    expect(screen.getByText("You are in no groups.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
