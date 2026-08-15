/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { user: null as { role: "user" | "owner" | "admin" } | null, loading: false },
  enroll: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/trpc", () => ({ trpc: { owner: { enroll: { useMutation: () => ({ mutate: mocks.enroll, isPending: false }) } } } }));
vi.mock("wouter", () => ({ Link: ({ children }: { children: React.ReactNode }) => children, useLocation: () => ["/cadastre-estabelecimento", mocks.navigate] }));

import PartnerSignup, { partnerSignupPath } from "./PartnerSignup";

afterEach(() => { cleanup(); mocks.enroll.mockReset(); mocks.navigate.mockReset(); });

describe("entrada de cadastro de estabelecimento", () => {
  it("envia o visitante ao login preservando o retorno ao cadastro", async () => {
    mocks.auth.user = null;
    const user = userEvent.setup();
    render(<PartnerSignup />);
    await user.click(screen.getByRole("button", { name: "Criar conta ou entrar" }));
    expect(mocks.navigate).toHaveBeenCalledWith(`/entrar?retorno=${encodeURIComponent(partnerSignupPath)}`);
  });

  it("ativa o perfil de parceiro para um usuário autenticado antes do formulário", async () => {
    mocks.auth.user = { role: "user" };
    const user = userEvent.setup();
    render(<PartnerSignup />);
    await user.click(screen.getByRole("button", { name: "Continuar para o cadastro" }));
    expect(mocks.enroll).toHaveBeenCalledTimes(1);
  });

  it("reconhece parceiros existentes e oferece o acesso ao painel", () => {
    mocks.auth.user = { role: "owner" };
    render(<PartnerSignup />);
    expect(screen.getByText("Você já é parceiro do Tô no Sal")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ir para meu painel" })).toBeTruthy();
  });
});
