/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestHighlight: vi.fn(),
  invalidate: vi.fn(),
  refreshAuth: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, role: "owner" }, refresh: mocks.refreshAuth }),
}));

vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/lib/trpc", () => {
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  const overview = {
    establishments: [{ id: 8, name: "Quiosque do Sal", isActive: true, categoryName: "Alimentação", neighborhood: "Atalaia", city: "Salinópolis", description: "Quiosque de teste para o calendário de Destaques.", images: [] }],
    plans: [{ id: 4, code: "semana", label: "Destaque semanal", priceCents: 4900, durationDays: 7, isActive: true }],
    paymentRequests: [],
    monthlySubscriptions: [],
    paymentSettings: { pixKey: null, recipientName: null, instructions: null },
  };
  return {
    trpc: {
      useUtils: () => ({ owner: { overview: { invalidate: mocks.invalidate } }, auth: { me: { invalidate: mocks.invalidate } } }),
      directory: { categories: { useQuery: () => ({ data: [] }) } },
      owner: {
        overview: { useQuery: () => ({ data: overview, isLoading: false }) },
        highlightAvailability: { useQuery: () => ({ data: { days: [{ date: "2026-09-10", endsAt: "2026-09-16", availableSlots: 0, isAvailable: false }, { date: "2026-09-11", endsAt: "2026-09-17", availableSlots: 2, isAvailable: true }] }, isFetching: false }) },
        uploadImage: { useMutation: mutation },
        enroll: { useMutation: mutation },
        completeRegistration: { useMutation: mutation },
        updateEstablishment: { useMutation: mutation },
        requestHighlight: { useMutation: () => ({ mutate: mocks.requestHighlight, isPending: false }) },
        submitPixProof: { useMutation: mutation },
      },
    },
  };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import PartnerPortal from "./PartnerPortal";

describe("PartnerPortal — agendamento de Destaques", () => {
  it("mostra a data ocupada como bloqueada e envia requestHighlight somente com a data livre selecionada", async () => {
    mocks.requestHighlight.mockReset();
    const user = userEvent.setup();
    render(<PartnerPortal />);

    fireEvent.change(screen.getByLabelText("Estabelecimento"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Plano de Destaque"), { target: { value: "4" } });

    const unavailableLabel = await screen.findByText("Indisponível");
    const unavailableButton = unavailableLabel.closest("button") as HTMLButtonElement;
    expect(unavailableButton.disabled).toBe(true);
    await user.click(unavailableButton);
    expect(unavailableButton.getAttribute("aria-pressed")).not.toBe("true");

    const availableButton = screen.getByRole("button", { name: /2 vagas/i });
    await user.click(availableButton);
    expect(availableButton.getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Gerar PIX do Destaque" }));
    await waitFor(() => expect(mocks.requestHighlight).toHaveBeenCalledWith(expect.objectContaining({ establishmentId: 8, planId: 4, ownerNote: null })));
    const request = mocks.requestHighlight.mock.calls[0]?.[0] as { startsAt: Date };
    expect(request.startsAt.toISOString()).toBe("2026-09-11T12:00:00.000Z");
  });
});
