import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CookMode } from "@/components/cook-mode";

vi.mock("@/lib/use-wake-lock", () => ({ useWakeLock: () => {} }));

const steps = ["Chop the onion.", "Brown the beef.", "Simmer and serve."];

describe("CookMode", () => {
  it("starts on step 1 and advances with Next", async () => {
    const user = userEvent.setup();
    render(<CookMode title="Ragù" slug="ragu" steps={steps} ingredients={[]} />);
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Chop the onion.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Brown the beef.")).toBeInTheDocument();
  });

  it("shows a Done link on the last step", async () => {
    const user = userEvent.setup();
    render(<CookMode title="Ragù" slug="ragu" steps={steps} ingredients={[]} />);
    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Done" })).toHaveAttribute("href", "/recipe/ragu");
  });

  it("disables Back on the first step", () => {
    render(<CookMode title="Ragù" slug="ragu" steps={steps} ingredients={[]} />);
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("renders gracefully with no steps", () => {
    render(<CookMode title="Ragù" slug="ragu" steps={[]} ingredients={[]} />);
    expect(screen.getByText("No steps yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Done" })).toHaveAttribute(
      "href",
      "/recipe/ragu",
    );
  });

  it("toggles the ingredient peek", async () => {
    const user = userEvent.setup();
    render(
      <CookMode
        title="Ragù"
        slug="ragu"
        steps={steps}
        ingredients={[{ _key: "i1", name: "onion", quantity: "1", unit: "" }]}
      />,
    );
    expect(screen.queryByText("onion")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ingredients" }));
    expect(screen.getByText("onion")).toBeInTheDocument();
  });
});
