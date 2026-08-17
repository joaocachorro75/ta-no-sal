/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }));

import InstallAppButton from "./InstallAppButton";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation(() => ({ matches: false })),
});

afterEach(() => cleanup());

describe("InstallAppButton", () => {
  it("mostra a chamada de instalação solicitada antes da instalação", () => {
    render(<InstallAppButton />);
    expect(screen.getByRole("button", { name: /instalar o aplicativo tô no sal/i }).textContent).toContain("Instale nosso Aplicativo");
    expect(screen.getByRole("button").querySelector("img")?.getAttribute("src")).toBe("/uploads/system/demo-assets/to-no-sal-app-icon.png");
  });

  it("aciona o prompt PWA quando o navegador o disponibiliza", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const installEvent = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: "dismissed" as const }) });
    const user = userEvent.setup();
    render(<InstallAppButton />);
    window.dispatchEvent(installEvent);
    await user.click(screen.getByRole("button", { name: /instalar o aplicativo tô no sal/i }));
    expect(prompt).toHaveBeenCalledTimes(1);
  });
});
