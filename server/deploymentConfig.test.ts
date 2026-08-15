import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");

describe("configuração de implantação", () => {
  it("aplica as migrations antes de iniciar o servidor no contêiner de produção", () => {
    const dockerfile = fs.readFileSync(path.join(projectRoot, "Dockerfile"), "utf8");
    expect(dockerfile).toContain("corepack pnpm db:migrate && exec node dist/index.js");
    expect(dockerfile).toContain("ENV NODE_ENV=production");
  });

  it("documenta a URL interna do banco e o volume de uploads do EasyPanel", () => {
    const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
    expect(readme).toContain("DATABASE_URL");
    expect(readme).toContain("/data/uploads");
    expect(readme).toContain("Dockerfile");
    expect(readme).toContain("login de usuários e parceiros é **local**");
    expect(readme).toContain("JWT_SECRET");
  });
});
