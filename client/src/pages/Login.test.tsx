/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  invalidate: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { invalidate: mocks.invalidate } } }),
    auth: {
      login: { useMutation: () => ({ mutate: mocks.login, isPending: false, error: null }) },
      register: { useMutation: () => ({ mutate: mocks.register, isPending: false, error: null }) },
    },
  },
}));
vi.mock("wouter", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useLocation: () => ["/entrar", mocks.navigate],
}));

import Login from "./Login";

afterEach(() => { cleanup(); mocks.login.mockReset(); mocks.register.mockReset(); mocks.invalidate.mockReset(); mocks.navigate.mockReset(); window.history.replaceState({}, "", "/entrar"); });

describe("entrada local", () => {
  it("alterna para criar conta e envia as credenciais locais", async () => {
    const user = userEvent.setup();
    render(<Login />);
    await user.click(screen.getByRole("button", { name: "Criar agora" }));
    await user.type(screen.getByLabelText("Seu nome"), "Ana do Sal");
    await user.type(screen.getByLabelText("E-mail"), "ana@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-local-123");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(mocks.register).toHaveBeenCalledWith({ name: "Ana do Sal", email: "ana@example.com", password: "senha-local-123" });
  });

  it("mantém o retorno local seguro para o fluxo de parceiro", () => {
    window.history.replaceState({}, "", "/entrar?retorno=%2Fcadastre-estabelecimento");
    render(<Login />);
    expect(screen.getByText("Entre na sua conta")).toBeTruthy();
  });
});
