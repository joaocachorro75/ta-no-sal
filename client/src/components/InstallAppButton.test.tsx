/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }));

import InstallAppButton from "./InstallAppButton";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation(() => ({ matches: false })),
});

describe("InstallAppButton", () => {
  it("mostra o rótulo curto solicitado antes da instalação", () => {
    render(<InstallAppButton />);
    expect(screen.getByRole("button", { name: /instalar o aplicativo tô no sal/i }).textContent).toContain("Instalar app");
  });
});
