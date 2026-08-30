# Changelog

All notable changes to this project are documented here.

### Documentation

- Add migration notice to README

## [v1.5.10] - 2026-07-28

### Bug Fixes

- Remove extra brace in generator.ts

### Chores

- V1.5.10 [skip ci] _(release)_

### Other

- Merge development → master (error fixes, security hardening, refactor) _(other)_

## [v1.5.9] - 2026-07-28

### Bug Fixes

- Skip real del Release (job-level) + correcciones del README _(ci)_

### Chores

- V1.5.9 [skip ci] _(release)_

## [v1.5.8] - 2026-07-28

### Bug Fixes

- Prevent circular trigger in Release workflow _(ci)_

- Prevent circular trigger in Release workflow _(ci)_

### Chores

- V1.5.8 [skip ci] _(release)_

### Documentation

- Update to latest screenshot _(readme)_

## [v1.5.7] - 2026-07-28

### Chores

- V1.5.7 _(release)_

### Documentation

- Note Kiro used as agentic IDE for development _(readme)_

- Note Kiro used as agentic IDE for dev _(readme)_

- Add Kiro integration section _(readme)_

- Add Kiro integration section _(readme)_

## [v1.5.6] - 2026-07-28

### Chores

- V1.5.6 _(release)_

### Documentation

- Add 'Flujo del Creator' heading above flow diagram _(readme)_

- Add 'Flujo del Creator' heading above flow diagram _(readme)_

- Move landing screenshot above creator flow _(readme)_

- Move landing screenshot above creator flow _(readme)_

- Add 'Landing page' heading above screenshot _(readme)_

- Add 'Landing page' heading above screenshot _(readme)_

## [v1.5.5] - 2026-07-28

### Chores

- V1.5.5 _(release)_

### Documentation

- Add descriptive caption to landing screenshot _(readme)_

- Update to latest screenshot _(readme)_

- Update screenshot _(readme)_

- Add screenshot to ES/EN README _(readme)_

### Other

- Landing screenshot + sprint 2 _(other)_

## [v1.5.4] - 2026-07-28

### Bug Fixes

- Force remount DynamicQuestion on question change _(creator)_

### Chores

- V1.5.4 _(release)_

## [v1.5.3] - 2026-07-28

### Bug Fixes

- Replace OG image with SPR branding _(meta)_

- Address 9 high-severity npm audit vulnerabilities (postcss, sharp, glob)

- Traduce el árbol de decisiones al inglés en la UI (#740) _(creator)_

- La documentación en inglés muestra el índice completo (#736) _(docs)_

### Chores

- V1.5.3 _(release)_

### Documentation

- Corrige el spot-check de contenido del runbook (#739) _(deploy)_

### Other

- Development → master (sprint 2) _(other)_

## [v1.5.2] - 2026-07-28

### Bug Fixes

- Separa los artefactos comunes del grupo Portátil _(creator)_

- Separa los artefactos comunes del grupo Portátil _(creator)_

- Application_instructions derivadas de los artefactos reales _(creator)_

- Deriva application_instructions de los artefactos generados _(creator)_

- El prompt de onboarding usa https para hosts públicos _(creator)_

- El prompt de onboarding anuncia https para hosts públicos _(creator)_

- Elimina las capas glass anidadas inertes _(landing)_

- Elimina las capas glass anidadas inertes _(landing)_

### CI/CD

- Ejecuta Vitest y typecheck del frontend en CI

- Ejecuta los tests de Vitest y el typecheck del frontend en CI

### Chores

- V1.5.2 _(release)_

- Formatea el repo y hace bloqueante el Format check _(ci)_

- Formatea el repo y hace bloqueante el Format check _(ci)_

- Desactiva Vercel también en agent-creator/vercel.json _(deploy)_

- Desactiva Vercel también en agent-creator/vercel.json _(deploy)_

- Desactiva los despliegues automáticos de Vercel _(deploy)_

- Desactiva los despliegues automáticos de Vercel _(deploy)_

- Desactiva los despliegues de Vercel desde el repo _(deploy)_

- Desactiva los despliegues automáticos de Vercel _(deploy)_

- Desactiva los despliegues automáticos de Vercel _(deploy)_

- Desactiva los despliegues automáticos de Vercel _(deploy)_

- LICENSE canónico MPL-2.0 + NOTICE _(license)_

- Desactiva los despliegues automáticos de Vercel _(deploy)_

- Restaura el texto canónico de MPL-2.0 y mueve el aviso a NOTICE _(license)_

### Documentation

- Verificación de que producción coincide con master _(deploy)_

- Documenta y automatiza la verificación de prod vs master _(deploy)_

### Testing

- Evita la carrera con la carga inicial del Creator _(e2e)_

- Evita la carrera con la carga inicial del Creator _(e2e)_

- Aisla el almacenamiento web entre tests _(frontend)_

- Ejecuta la suite de Playwright en CI Extended _(e2e)_

- Ejecuta la suite de Playwright en CI Extended _(e2e)_

## [v1.5.1] - 2026-07-28

### Bug Fixes

- Value prop cards usan el glass transparente compartido _(landing)_

### Chores

- V1.5.1 _(release)_

## [v1.5.0] - 2026-07-28

### Bug Fixes

- Restore liquid glass blur on value prop cards _(landing)_

- Alinear formatos de CodeRabbit, Kilo Code y Windsurf con docs oficiales _(generator)_

- Imágenes docs, docs en inglés y catálogo limpio _(docker,frontend)_

- Resolver errores del smoke test #699 _(docker,health,docs,api)_

- Eliminar sección ADRs de la documentación web _(docs)_

- Eliminar compatibilidad del header y del landing _(landing)_

- Potenciar blur del glass en value props _(landing)_

- Renderizar HTML y alertas GitHub en la vista de documentación _(docs)_

- Posicionar botón de idioma abajo a la derecha en todas las vistas _(ui)_

- Aplicar glassStyle existente al componente de value props _(landing)_

- Eliminar sección de compatibilidad del landing principal _(landing)_

- Ajustar glass estándar en value props y eliminar trust line _(landing)_

### Chores

- V1.5.0 _(release)_

### Features

- Restaurar sección de compatibilidad solo en el landing _(landing)_

- Mostrar métricas de compatibilidad y aplicar liquid glass a value props _(landing)_

## [v1.4.2] - 2026-07-28

### Chores

- V1.4.2 _(release)_

- Update all URLs from Vercel to Netlify (artemisa-ai.netlify.app)

## [v1.4.1] - 2026-07-28

### Bug Fixes

- Make husky CI-safe for Netlify/DO builds

### Chores

- V1.4.1 _(release)_

## [v1.4.0] - 2026-07-27

### Bug Fixes

- Reubicar botón de idioma a la derecha en modo creación _(creator)_

- Reubicar botón de idioma a la derecha en modo creación (#689). _(creator)_

### Chores

- V1.4.0 _(release)_

### Documentation

- Importar espejo local de la documentación de DeepWiki _(deepwiki)_

- Importar espejo local de la documentación de DeepWiki. _(deepwiki)_

- Eliminar referencias al Runtime eliminado y documentación obsoleta _(cleanup)_

- Eliminar referencias al Runtime eliminado y documentación obsoleta (#674 follow-up). _(cleanup)_

### Features

- Sección de compatibilidad con métricas reales _(landing)_

- Sección de compatibilidad con métricas reales (#688). _(landing)_

### Other

- Merge development into master _(other)_

- Extraer aria-label hardcodeado del dashboard de ajuste fino _(advanced)_

- Extraer aria-label hardcodeado del dashboard de ajuste fino (#690). _(advanced)_

## [v1.3.0] - 2026-07-27

### Bug Fixes

- Aplicar estilo liquid glass estándar en la sección de features _(landing)_

- Aplicar estilo liquid glass estándar en la sección de features (#687). _(landing)_

- Eliminar documentación de Use Cases y agregar fallback a español. _(docs)_

- Eliminar modal y traducciones de Use Cases de la landing. _(frontend)_

### Chores

- V1.3.0 _(release)_

### Documentation

- Sincronizar traducciones .en.md con la actualización de docs (#685). _(i18n)_

- Rewrite README.md from scratch for the generator-only product

- Update README.md with current generator-only scope

- Remove remaining Runtime/agent-creator references across docs

- Remove deprecated agent-creator deployment content

- Remove creator-bundle.svg reference from legacy README

- Remove unused creator-bundle.svg and legacy reference

- Remove remaining stale Runtime references and config

- Remove stale knip ignore, pnpm-workspace, and SVG registration button

- Remove stale Runtime references from docs and source comments

- Remove stale Runtime references — types, test data, config, and documentation

### Features

- Soporte completo de inglés en frontend y documentación core _(i18n)_

- Reducir docs .en.md a solo la documentación core nueva. _(i18n)_

- Soporte completo de inglés en frontend y documentación. _(i18n)_

### Other

- Migrate backend from Render to DigitalOcean App Platform _(other)_

## [v1.2.1] - 2026-07-27

### Chores

- V1.2.1 _(release)_

## [v1.2.0] - 2026-07-27

### Chores

- V1.2.0 _(release)_

## [v1.1.1] - 2026-07-27

### Chores

- V1.1.1 _(release)_

## [v1.1.0] - 2026-07-27

### Bug Fixes

- Strip v prefix from git-cliff to prevent double-v tags _(ci)_

### Chores

- V1.1.0 _(release)_

- Vv0.1.0 _(release)_

### Other

- V1.0.0 — Artemisa hackathon-ready _(other)_

## [v1.0.0] - 2026-07-27

### Bug Fixes

- Pin Render starter plan, add CORS and health check, align Vercel auth _(deploy)_

- Strip v prefix from git-cliff to prevent double-v tags (#661) _(ci)_

- Expand agent capabilities, add max autonomy, multi-custom, expandable lists (#658) _(creator)_

- Stabilize bundle icon and remove advanced mode pre-gen rail (#656) _(creator)_

- Add project stage option, expand environments, remove preset answers button (#655) _(creator)_

- Add missing None/Local options to catalog questions and clear custom field (#654) _(creator)_

- Make navigation buttons fixed so they're always visible (#653) _(creator)_

- Update env var name from HUASCAR to ARTEMISA in sync test (#657) _(test)_

- Keep developer GitHub usernames on one line and align buttons (#628) _(frontend)_

- Simplify completion flow with LLM-first CTA (#615) (#630) _(creator)_

- Use static MPL-2.0 badge and purple Important callouts _(readme)_

- Refresh value propositions with compatibility and impact (#619) _(landing)_

- Refresh PWA updates safely (#614)

- Reorganize sticky nav and make space simulation frame-rate independent (#613) _(landing)_

- Accent only changes on genuine mouseenter of button/link _(ui)_

- Accent colour only changes on truly different hover targets _(ui)_

- Remove dotenv and Pino from tech stack badges _(landing)_

- Change accent colour on hover, not on a timer _(ui)_

### Documentation

- Clean up outdated defensive statements and Runtime history (#674) _(readme)_

- Restore hackathon hero, badges and Important callouts lost in rename (#665) _(readme)_

- Redesign hero with hackathon branding and for-the-badge shields (#622) _(readme)_

- Sync Creator env examples (#617)

- Document creator auth (#612)

### Features

- Add PROMPT.md artifact and surface it in the completion screen (#668) _(generator)_

- Expand skills and MCP catalogs (#647) (#659) _(catalog)_

- Rename project from Huascar to Artemisa (#627)

- Add multi-language support with es/en (#620) (#631) _(i18n)_

- Apple-style smooth momentum scroll with lerp interpolation (#623) _(landing)_

- Redesign docs page with sidebar nav and inline GitHub rendering (#611) _(docs)_

- Add /desarrolladores page with team cards (#616) _(frontend)_

- Responsive landing, touch device detection, responsive canvas (#609) _(ux)_

- Assign different RGB palette colour to each accent surface _(ui)_

- Add brand colours to tech stack badges _(landing)_

- Cycle brand accent randomly through the RGB rainbow _(ui)_

- Reflect multi-platform support in the UI (#604) _(creator)_

### Other

- Relocate Docker, config and docs to reduce top-level clutter (#680) _(root)_

- Reorganize final review into explanation top, decisions below (#666) _(creator)_

- Render review decisions in a two-column grid (#633) _(creator)_

- Remove accent colour cycling, restore fixed red accent _(ui)_

### Refactor

- Remove remaining Huascar references and complete rename (#632) _(repo)_

- Optimize AI-facing artifacts (#667) _(generator)_

## [v0.1.0] - 2026-07-26

### Bug Fixes

- Add npm overrides for postcss and sharp vulnerabilities (#606) _(deps)_

- Align UI copy with generator scope (#602) _(frontend)_

- A11y, perf, SEO y polish (#579, #580, #570, #581) (#595) _(frontend)_

- QuickStartCopy textarea, tilde y anuncio único (#554, #572) (#587) _(frontend)_

- Cleanup dead config and tracked artifacts (#525)

- Smoother scroll snap on landing (#519) _(frontend)_

- Polish landing responsive + e2e cover Creator mobile block (#518) _(frontend)_

- Remove .node-version from tracking and reconcile .gitignore (#521) _(git)_

- Connect testing_tools to bundle output (#509) _(tree)_

- Consume skills_selection and mcps_selection in the bundle (#500) _(creator)_

- Replace emerald/cyan accent palette with red corporate _(ui)_

- Add red accent to minimalist glass scrollbar _(ui)_

- Minimalist liquid glass scrollbar _(ui)_

- Liquid glass effect on scrollbar _(ui)_

- Red accent scrollbar with glow matching galactic theme _(ui)_

- Apply custom scrollbar globally across the app _(ui)_

- Allow scroll on dashboard by removing conflicting Tailwind classes _(ui)_

- Add favicon, OG tags and branding assets _(frontend)_

- Replace emerald/cyan accent palette with red corporate (#f50b0b) _(ui)_

- Add favicon, OG tags and branding assets _(frontend)_

- Add favicon, OG tags and branding assets _(frontend)_

- Overhaul /agents/new UI — repair four modes, simplify UX _(creator)_

- Simplify CI workflow — remove fragile cross-job node_modules cache _(ci)_

- Remove dead scaffold in features/dashboard and features/creator (#480) _(frontend)_

- Add k3s to containers category (#477) _(catalog)_

- Regenerate package-lock.json for npm 10.x compatibility (#475) _(agent-creator)_

- Add missing skills_focus/mcps_enabled to E2E fixtures (#473) _(tests)_

- Improve progress bar contrast for projectors (#466) _(creator)_

- Make sticky header/footer discoverable by default (#446) (#461) _(landing)_

- Align dashboard aesthetic with Creator glass/starfield (#444) (#462) _(dashboard)_

- Creator UI minimalist background, fixed layout, glass polish (#465) _(frontend)_

- Integrate useTranslations into real components (#429) _(frontend)_

- Remove dead on_commit HITL stub, document real diff flow (#418) (#430) _(hooks)_

- Integrate PromptTemplate into HuascarEngine.executeTask (#419) (#428) _(engine)_

- Integrate emitWebhook into HuascarEngine.executeTask (#420) (#427) _(webhooks)_

- Add retry with registry-error fallback to npm audit job (#431) _(ci)_

- Creator UI redesign — 4 modes, landing-faithful glass (#422) _(frontend)_

- Emit schema-valid huascar/* artifacts so applied bundles work (#381) _(creator)_

- Repair e2e/eval infra, LLM provider compat, workspace docs (#380)

- Integration test supports problem+json error format (#347) _(test)_

- Final quality batch — stack-specific docs, VPS rec, problem+json, compact evaluate (#344) _(creator)_

- Quality enhancements — personalized steering, dynamic security, architecture recommendations (#343) _(creator)_

- 4 critical generation bugs — RAG patterns, MCP config, INSTALL.md (#342) _(creator)_

- Multi-tenancy isolation — derive tenant ID per API key (#314) _(arch)_

- Agent-creator Docker runs as non-root, local pinned serve (#312) _(devops)_

- Add circuit breaker for LLM provider calls (#311) _(arch)_

- Add **proto**/constructor/prototype sanitization middleware (#310) _(security)_

- Wire deep health check to /api/health, add liveness/readiness probes (#309) _(arch)_

- Frontend API URL defaults to localhost, warns on non-local (#308) _(security)_

- Batch reliability — CORS null origin, MCP idle cleanup, ErrorBoundary (#307)

- Batch hardening — 8 issues (#306) _(security)_

- Reliability and security improvements (18 issues) (#305)

- Add AUTH_REQUIRED=false to docker smoke test (#304) _(ci)_

- Update Next.js to 16.2.11, add sharp>=0.35.0, fix Turbopack root (#303) _(security)_

- Enable authentication by default (#302) _(security)_

- Block command injection via shell metacharacters (#301) _(security)_

- Harden debug routes — remove replay, restrict info, add TTL (#299) _(security)_

- Harden admin bypass — request-scoped, timing-safe, audited (#298) _(security)_

- Enforce role isolation on memory API (#297) _(security)_

- Harden pipeline endpoint with server-side limits (#296) _(security)_

- Eliminate timing oracle in auth token validation (#295) _(security)_

- Add auth headers to frontend API clients (#294) _(security)_

- Restrict client RAG sources to inline-only (#293) _(security)_

- Block client-side system_prompt injection (#292) _(security)_

- Enforce auth on Render deployment and remove hardcoded URL (#291) _(security)_

- Prevent DOM-based injection via URL query parameters (#290) _(frontend)_

- Robustness fixes for issues #209-#237 (#238) (#239)

- Robustness fixes for issues #209-#237 (#238)

- Use socket.destroyed to detect real client disconnection (#206) _(routes)_

- Cancel timed-out MCP executions with AbortSignal (#123) _(security)_

- Expand .gitignore for .env, IDE, and OS artifacts (#158) _(repo)_

- Bound and paginate execution history (#157) _(security)_

- Add dead code detection with knip (#161) _(tech-debt)_

- Harden backend — helmet, content-type, startup warnings (#131) _(security)_

- Resolve strict TypeScript fallout and integration test drift (#204) _(types)_

- Enforce tool selection and approval controls (#130) _(security)_

- Restrict local files accepted by RAG ingestion (#127) _(security)_

- Add allowlist for MCP env var interpolation (#125) _(security)_

- Replace bypassable denylist with structured allowlist (#119) _(security)_

- Protect /api/metrics with authentication (#136) _(security)_

- Configure restrictive CORS with explicit origins (#124) _(security)_

- Prevent SSRF and bound remote RAG downloads (#128) _(security)_

- Add .env.example for frontend API URL configuration (#154) _(deploy)_

- Add test utilities for race condition and env pollution prevention (#156) _(testing)_

- Pin MCP server package versions (#155) _(security)_

- Harden .dockerignore with complete secret exclusions (#117) _(security)_

- Make Store.close() idempotent (#96) (#203)

- Ignore env/OS artifacts and add consistent npm config (#88) (#202)

- Improve dashboard accessibility and metadata (#19 #41 #84) (#198)

- Harden agent registry execution (#191)

- Harden session reuse and retry delays (#186)

- Normalize selected role after dynamic load (#181)

- Harden RAG embedding readiness and auth (#175)

- Make provider fallback safe after tool calls (#170)

- Honor explicit system prompt for existing roles (#31) (#141)

- Producciónizar agent-creator — replace Vite dev server with static serve (#115) _(docker)_

- Frontend fallback to correct backend URL on Render (#114) _(deploy)_

- Restrict CORS origins and protect /api/metrics (#103) _(security)_

- Harden Docker config — resource limits, secrets exclusion, NODE_ENV (#102) _(devops)_

- Remove bypass from model args and fix MCP timeout cancellation (#105) _(security)_

- Remove variable shadowing in ReAct loop — use systemPrompt directly (#107)

- Update repo URL to match current name (Huascar) _(render)_

- MCP+ReAct Oracle remediations - hook on tool calls, client.close, timeout, mock path fix

- Set proper HTML title for Huascar agent creator

- Remove node_modules from git tracking

### CI/CD

- Automatizar changelog con git-cliff en releases

- Automatizar changelog con git-cliff en releases

- Add GitHub Actions workflow

### Chores

- V0.1.0 _(release)_

- Implement pre-commit hooks with husky + lint-staged (#112)

- Add monorepo management scripts to root package.json (#111)

- Add CODEOWNERS, PR template, and issue templates (#110)

- Add prettier and .editorconfig for consistent formatting (#109)

- Configure Renovate for automated dependency updates (#108)

- Rename project to Huascar

### Documentation

- API reference, troubleshooting, self-hosting y apply-bundle (#576, #577) (#590)

- Corregir instrucciones rotas y anotar CHANGELOG post-Runtime (#573, #578) (#589)

- Document ephemeral agent env vars in README (#529)

- Disable GitHub Wiki and document where docs live (#370)

- Disable GitHub Wiki and document where docs live (#370)

- Add SVG diagrams and screenshots to README and agent-creator (#358)

- Add SVG diagrams and screenshots to README and agent-creator (#358)

- Agregar READMEs a subproyectos del monorepo

- Agregar READMEs a subproyectos del monorepo

- Corregir licencias SDK y raiz del proyecto

- Corregir licencias SDK y raiz del proyecto

- Agregar documentacion comunitaria y guia para contribuidores humanos

- Agregar documentacion comunitaria y guia para contribuidores humanos

- Limpiar documentacion obsoleta y agregar docs de scripts

- Limpiar documentacion obsoleta y agregar docs de scripts

- Infraestructura de documentacion (templates, SEO, versiones, funding)

- Infraestructura de documentacion (templates, SEO, versiones, funding)

- Renovar README principal con contexto hackathon, homepage y badges

- Renovar README principal con contexto hackathon, homepage y badges

- Apply phase 7 review cleanup (#197)

- Expand AI agent directives (#14) (#196)

- Add AI contributor guide (#79) (#195)

- Expand coding conventions (#70) (#194)

- Add machine-readable project context (#86) (#193)

- Add architecture decision records (#45) (#192)

- Update AGENTS.md branching strategy — master is production branch (#113)

- Add AI-Driven Development directives (AGENTS.md)

- Expand implementation plan into a complete hackathon sprint roadmap

- Add Huascar title to README

### Features

- Add skip link, focus-visible ring, and fix heading hierarchy (#601) _(a11y)_

- Add confirmation dialog before resetting draft (#599) _(creator)_

- Show toast notification when draft is restored (#605) _(creator)_

- Show custom option consequences before confirming (#603) _(creator)_

- Browser back button navigates within the Creator (#598) _(creator)_

- Implement focus trap for modals and shortcuts overlay (#596) _(a11y)_

- Replace planet icons with custom SVG glassmorphism icons (#585) _(landing)_

- Toggle de animaciones y scroll suave (#559, #388) (#607) _(landing+creator)_

- Ruta de documentación oficial + endpoint para modelos IA (#560) (#600)

- QuickStartCopy inline, landing glass styling and feature copy _(ui)_

- Make QuickStartCopy inline and keep card wrapper on landing (#542) (#543) _(ui)_

- Simplify QuickStartCopy and refresh landing colors for white-on-dark contrast (#528) _(ui)_

- Return 410 Gone for expired agents instead of 404 _(runtime)_

- Icons on landing nav links (header + footer) (#520) _(frontend)_

- Add LLM models catalog — 45 models, 8 providers (#524) _(catalog)_

- Expand MCP catalog from 33 to 83 servers (#517) _(catalog)_

- Expand skills catalog to 55 curated entries (#515) _(catalog)_

- Add recommendations for research, documentation and custom purposes (#511) _(tree)_

- Ephemeral registered agents with TTL and per-IP cooldown (#503) _(runtime)_

- Branded 404 page and global error boundary (#502) _(frontend)_

- Endpoint machine-friendly para agentes IA + protocolo 'huascar startup' _(api/creator)_

- Add public agent protocol endpoints and Huascar startup onboarding _(creator)_

- Multi-format generator for Cursor, Devin, CodeRabbit, Kilo Code and AGENTS.md _(creator)_

- Multi-format generator for Cursor, Devin, CodeRabbit, Kilo Code and AGENTS.md _(creator)_

- Add success micro-animation to CompletionScreen (#442) (#459) _(creator)_

- Add lightweight syntax highlighting to artifact preview (#443) (#460) _(creator)_

- Expand MCP catalog from 12 to 33 servers (#448) (#463) _(catalog)_

- Creator UI Redesign (Base implementation) (#391)

- Expand cloud catalog — 44 AWS/Azure/GCP services + cloud-native recommendations (#346) _(creator)_

- Massive catalog expansion — 100+ technologies across all computing domains (#345) _(creator)_

- Landing minimalista, liquid glass y licencia MPL-2.0 (#315) _(frontend)_

- Implement 11 features — eval, engine, testing, config, MCP, DX, SDK (#208)

- DevContainer, config cache, MCP retry & status (#207)

- Migrate to npm workspaces (#146) _(monorepo)_

- Coverage reports, Docker build verification, deploy stages (#147) _(ci)_

- Expand CI with parallel lint, test, and security audit (#140) _(ci)_

- Update branch strategy — target master + development (#138) _(ci)_

- Frontend test infra with Vitest + RTL (#153) _(testing)_

- Release automation with semantic versioning (#159) _(ci)_

- Deep health monitoring with self-healing alerts (#151) _(ops)_

- Implement webhook event system for execution notifications (#164) _(integration)_

- Add OpenTelemetry scaffolding for ReAct loop tracing (#162) _(observability)_

- Enable strict TypeScript sub-flags (#160) _(type-safety)_

- Configure lint-staged for pre-commit type-check (#139) _(dx)_

- Configure Renovate for automated dependency updates (#137) _(deps)_

- Implement rate limiting per IP and global (#133) _(security)_

- Enhance structured logging with correlation IDs (#149) _(observability)_

- Add TypeScript config to agent-creator for JSX→TSX migration (#168) _(type-safety)_

- Configure prettier + .editorconfig for consistent formatting (#142) _(dx)_

- Add monorepo management scripts (#143) _(dx)_

- CODEOWNERS, PR template, and issue templates (#144) _(governance)_

- Implement audit log and policy engine (#134) _(security)_

- Zod validation for requests and environment (#148) _(type-safety)_

- Add integration test helpers and property-based testing utilities (#165) _(testing)_

- Mock engine with configurable scenarios (#71) (#201)

- Expand data-driven agent roles (#20) (#200)

- Add SQLite data retention policy (#80) (#199)

- Add Next.js agent creator route (#116) (#189)

- Add persistent agent registry (#98) (#187)

- Stream agent execution events (#97) (#184)

- Persist agent sessions (#35) (#183)

- Retry transient LLM failures (#46) (#182)

- Expose OpenAPI spec endpoint (#23) (#179)

- Validate Kiro JSON schemas (#22) (#178)

- Expose dynamic roles endpoint (#82) (#177)

- Improve RAG pipeline resilience (#55) (#174)

- Add ANN vector index for RAG search (#33) (#173)

- Improve RAG semantic chunking (#100) (#172)

- Skip unchanged RAG source reindexing (#48) (#171)

- Support LLM provider fallback chain (#30) (#163)

- Pool MCP connections across requests (#26) (#145)

- Add SQLite migration runner (#56) (#25) (#135)

- Add pino structured logging (#54) (#122)

- Require authentication for protected API routes (#106) _(security)_

- Render server-driven workflow _(agent-creator)_

- Add guided agent configuration backend _(creator)_

- Deploy production — Docker, docs, RAG vectorial, CI migration

- Deep robustness pass (3 phases, 3 Oracle reviews)

- Add request monitoring middleware + metrics endpoint

- Add Fly.io config for free-tier deploy

- Complete Phase 2 - RAG web URLs, test suite, deploy config

- Add RAG engine, SQLite persistence, integration tests

- Add Docker setup, comprehensive README, finalize project

- Phase 2+3 complete - Tailwind, knowledge fix, completion screen, error handling

- Phase 1 Oracle remediations - validation, dangerouslySetInnerHTML, HTTP errors

- Phase 1 - Vite + React + JS scaffold with 7-step questionnaire architecture

- Phase 3 complete - E2E integration with remediations

- Complete E2E integration - frontend calls backend API with real fetch

- Implement Phase 1 Backend with HuascarEngine and Express API

- Add base Kiro configuration files (steering, hooks, mcps, rag)

### Other

- Bump version to 1.0.0 and add engines field (#593) _(other)_

- Eliminar documentación expirada del Runtime (#597) _(other)_

- Reposicionar Huascar como generador de archivos (#582) (#592) _(other)_

- Pantalla final con ZIP, pasos fijos y tab por defecto (#567) (#588) _(creator)_

- Remove the Runtime from the backend (#584) (#586) _(other)_

- Add aria-labels to landing nav links (#537) _(frontend)_

- Remove dead cn() re-export from glass.ts (#538) _(frontend)_

- Remove unused files, exports and ghost deps (#526) _(dead-code)_

- Remove sdk/ prototype (#523) _(structure)_

- Remove dead Dashboard UI for the legacy runtime (#501) _(frontend)_

- Remove emojis from source files _(other)_

### Performance

- Parallelize test suite with --test-concurrency and CI sharding (#412) (#540) _(tests)_

- Reduce landing bundle with code splitting (#535) _(frontend)_

- Parallelize test suite with --test-concurrency and CI sharding (#412) _(tests)_

- Respect prefers-reduced-motion and pause space-simulation when hidden (#516) _(frontend)_

- Minimal Service Worker with stale-while-revalidate (#514) _(frontend)_

- Dedup in-flight evaluate requests + last-result memo (#513) _(creator)_

- Stale-while-revalidate cache for Creator definition (#522) _(agent-creator)_

- Lazy-load runtime engine modules to speed up Creator cold start (#512) _(backend)_

- Compress, cache and memoize Creator responses (#510) _(backend)_

- Eliminate redundant evaluateDecisionTree call (#474) _(generator)_

- Share npm cache across jobs, docker buildx with layer caching (#471) _(ci)_

- Replace npx serve with Caddy in Dockerfile.agent-creator (#469) _(docker)_

- Use BuildKit cache mounts, remove duplicate build tools (#467) _(docker)_

- Native Node healthcheck + move pino-pretty to devDependencies (#470) _(docker)_

- Enable TypeScript incremental compilation (#472) _(build)_

- Enable WAL mode, prepared statements, and batch transactions (#432) _(store)_

- Parallelize server connects, circuit-break repeated failures (#382) _(mcp)_

### Refactor

- Split dashboard into components (#44) (#188)

- Split server into app and route modules (#42) (#176)

- Inject HuascarEngine dependencies (#89) (#169)

- Use structured AI SDK tool calling (#29) (#152)

- Make shutdown idempotent and graceful (#74) (#132)

- Add error taxonomy and central handler (#91) (#40) (#129)

- Extract config and security policy into declarative files

- Allow overriding OpenAI model via MODEL_ID env var

### Testing

- Edge-case tests for slugify/stableValue/inferCloudProvider (#508) (#539) _(creator)_

- Edge-case tests for slugify/stableValue/inferCloudProvider (#508) _(creator)_

- Unit tests for getSkillById/getMcpById (#504) (#532) _(creator)_

- Add E2E agent creation demo — full flow with verification (#359)

- Add comprehensive security test suite for critical attack vectors (#313) _(security)_

<!-- generated by git-cliff -->
