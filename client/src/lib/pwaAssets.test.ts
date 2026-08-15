import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "../../..");
const iconUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/XmGhyfjbDLltWEuU.png";

describe("identidade visual de instalação", () => {
  it("configura o ícone personalizado no manifesto PWA", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "client/public/manifest.webmanifest"), "utf8"));
    expect(manifest.icons).toContainEqual(expect.objectContaining({ src: iconUrl, purpose: "any maskable" }));
  });

  it("configura o mesmo ícone como favicon e ícone da tela inicial Apple", () => {
    const html = fs.readFileSync(path.join(projectRoot, "client/index.html"), "utf8");
    expect(html).toContain(`<link rel="icon" type="image/png" href="${iconUrl}" />`);
    expect(html).toContain(`<link rel="apple-touch-icon" href="${iconUrl}" />`);
  });
});
