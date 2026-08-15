import { Button } from "@/components/ui/button";
import { Download, Smartphone } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);
    const onPrompt = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPromptEvent); };
    const onInstalled = () => { setIsInstalled(true); setPromptEvent(null); toast.success("Tô no Sal instalado neste dispositivo."); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const install = async () => {
    if (isInstalled) return;
    if (!promptEvent) {
      toast("Para instalar, abra o menu do navegador e escolha “Adicionar à tela inicial”.", { icon: <Smartphone className="h-4 w-4" /> });
      return;
    }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setPromptEvent(null);
  };

  return <Button onClick={install} variant="outline" size="sm" className="rounded-full border-[#0b6876]/15 bg-white/65 px-3 text-[0.65rem] font-bold text-[#0b6876] backdrop-blur-md hover:bg-white sm:px-3.5 sm:text-xs" aria-label="Instalar o aplicativo Tô no Sal"><Download className="h-3.5 w-3.5" /><span>{isInstalled ? "App instalado" : "Instalar app"}</span></Button>;
}
