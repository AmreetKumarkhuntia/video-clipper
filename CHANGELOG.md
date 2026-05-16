# [1.10.0](https://github.com/AmreetKumarkhuntia/video-clipper/compare/v1.9.0...v1.10.0) (2026-05-16)


### Bug Fixes

* **analysis:** respect saved SCORE_THRESHOLD, persist slider to config, add bulk select ([2ca031c](https://github.com/AmreetKumarkhuntia/video-clipper/commit/2ca031cb7f43fb9f7d327ac95c5b9ce6413a494e))
* **clip-editor:** fix render fidelity for crop mode, word highlights, and trim offsets ([9557b9d](https://github.com/AmreetKumarkhuntia/video-clipper/commit/9557b9d7dd5e7eeddf719f03ae21ce8193a6fa54))
* **clip-editor:** subtitle plan 400, partial-download A/V sync, delete subtitle UI ([e3bebc7](https://github.com/AmreetKumarkhuntia/video-clipper/commit/e3bebc7ac8857a94b27b9b6af16052ec412bbfef))
* **clips:** prune dropped clip artifacts on re-selection so publish draft reflects current picks ([cebd0c0](https://github.com/AmreetKumarkhuntia/video-clipper/commit/cebd0c04941ef91a9696efc8e60bdfaaa12380fb))
* **publish:** always upload edited clip when available, allow preview without render ([6c9524a](https://github.com/AmreetKumarkhuntia/video-clipper/commit/6c9524a2292accc67a8865552d5e6f1da6b8a683))


### Features

* **clip-editor:** add bg padding/radius controls, apply-to-all, and fix stale publish paths ([8908ab2](https://github.com/AmreetKumarkhuntia/video-clipper/commit/8908ab2ec4e9d70d53873cbda148f09b9cb12253))
* **clip-editor:** add Phase 1 + Phase 2 clip editor ([ffc6f48](https://github.com/AmreetKumarkhuntia/video-clipper/commit/ffc6f486690d167b1ede1af294bd1e6723ce7811))
* **clip-editor:** add Phase 3 timeline, canvas drag, and reframe focus ([f138e89](https://github.com/AmreetKumarkhuntia/video-clipper/commit/f138e8943d13c3cedb693d61f84a09f5461ce478))
* **clip-editor:** add Phase 4 dirty-warning dialog and Playwright smoke tests ([5e67fc3](https://github.com/AmreetKumarkhuntia/video-clipper/commit/5e67fc37ac9c68032a4c3c3f0032d0ac470542ba))
* **clip-editor:** add preview modal, render parity, and stale-render tracking ([fe1188a](https://github.com/AmreetKumarkhuntia/video-clipper/commit/fe1188ac6149221f109e80d8cddcc38922bcf850))
* **clip-editor:** plan subtitles, scrubbable timeline, word re-timing on edit ([1b221d7](https://github.com/AmreetKumarkhuntia/video-clipper/commit/1b221d753af10cb8c7dea4dbf43b07e58d1c6a6a))
* **video-store:** add session-level store keyed by video and analysis id ([4e83f4e](https://github.com/AmreetKumarkhuntia/video-clipper/commit/4e83f4e442ed9cf6bcfd3a6ecd133d5726eb98f4))

# [1.9.0](https://github.com/AmreetKumarkhuntia/video-clipper/compare/v1.8.0...v1.9.0) (2026-05-11)


### Bug Fixes

* **analyze:** rebuild activity rail and align timeline ticks to time ([2cb6cfb](https://github.com/AmreetKumarkhuntia/video-clipper/commit/2cb6cfb2915d27d8f0ef69eb14ed3ddec03a4f10))
* **claude:** tighten no-inline-types hook regex ([03f55e1](https://github.com/AmreetKumarkhuntia/video-clipper/commit/03f55e1a022b104c2db0e3547c5f4f04227258b4))
* **ui:** unblock /settings toggle clicks and add onOverlay text token ([9a765e3](https://github.com/AmreetKumarkhuntia/video-clipper/commit/9a765e339b51eea38105a7678f2bfe648317ea53))


### Features

* **analysis-page:** add score threshold slider wired to config store ([caed4e9](https://github.com/AmreetKumarkhuntia/video-clipper/commit/caed4e9ec8493234624e8d845cdff1bc871aeddf))
* **analyze:** add clip timeline with zoom and segment preview ([bf3ec6c](https://github.com/AmreetKumarkhuntia/video-clipper/commit/bf3ec6c0b70d066be0181faa66f47f4ac5b80805))
* **analyze:** add Stop / per-video cache controls + streaming timeline ([bb520f9](https://github.com/AmreetKumarkhuntia/video-clipper/commit/bb520f9b5ce9a526a53a654b3494dbb788e859ad))
* **prepare:** add collapsible cards and bulk select/deselect ([2116164](https://github.com/AmreetKumarkhuntia/video-clipper/commit/21161648b3aad0f6fe8d6fabf617dd7bd3dbb1b4))
* **publish:** add date/scheduling option for clip publishing ([b920604](https://github.com/AmreetKumarkhuntia/video-clipper/commit/b9206041c669e7cf09a09ce7052a4ee4582753a7))
* **publish:** split clip editor into modal, restructure publish page, share draft-item types ([604326f](https://github.com/AmreetKumarkhuntia/video-clipper/commit/604326f62f5c44f764e4d722d0b492e6bb3a67c4))
* **settings:** add sectioned layout, provider grid, and scroll containment ([2e4b489](https://github.com/AmreetKumarkhuntia/video-clipper/commit/2e4b4894990b78195b8974b6811f7c52de2345de))
* **ui:** add design-system form components and migrate all raw inputs ([ae93ae8](https://github.com/AmreetKumarkhuntia/video-clipper/commit/ae93ae82fe421f2e721f4bb3b0b9794c684af683))
* **ui:** add shared Badge component and migrate ad-hoc pills ([cb70902](https://github.com/AmreetKumarkhuntia/video-clipper/commit/cb70902c61c38ad964ff919940d85bdbb4561f44))
* **ui:** add shared Card component and migrate ad-hoc card wrappers ([24b61c3](https://github.com/AmreetKumarkhuntia/video-clipper/commit/24b61c35213a6f63f6e9b87093e326ea0d0375c5))
* **ui:** add unified Button component and replace all raw button callsites ([939d70c](https://github.com/AmreetKumarkhuntia/video-clipper/commit/939d70c1820e5398a3ceeb59205a3a2d5b196213))
* **web-ui:** migrate to Svelte 5 runes and --vc-* design system ([b06c1f6](https://github.com/AmreetKumarkhuntia/video-clipper/commit/b06c1f6cd258c75779ee06950f6f7c5cc0ec2c94))

# [1.8.0](https://github.com/AmreetKumarkhuntia/video-clipper/compare/v1.7.0...v1.8.0) (2026-05-06)


### Bug Fixes

* **button:** improve hover animation visibility ([9a02c7a](https://github.com/AmreetKumarkhuntia/video-clipper/commit/9a02c7a12fff81b8327dd7de476b47495261029e))
* **clip-service:** deduplicate clip artifacts by videoId and segmentId ([503ab44](https://github.com/AmreetKumarkhuntia/video-clipper/commit/503ab44bac4ca7ceb516272ebbb67ab18953cb87))
* **logging:** include request ids in analysis function logs ([1889726](https://github.com/AmreetKumarkhuntia/video-clipper/commit/1889726a576dace89f7c3837d20a205cfc87fcc1))
* **transcript:** add --format mhtml to yt-dlp subtitle fetch and target correct Chrome profile ([999b560](https://github.com/AmreetKumarkhuntia/video-clipper/commit/999b560e73867b457bdd54e7f2de0536d62b6cd1))


### Features

* **analysis:** add streaming LLM progress via SSE and StreamCallbacks ([6112ece](https://github.com/AmreetKumarkhuntia/video-clipper/commit/6112ece91eef7787c70f74076cf17b08512a8f64))
* **analysis:** enrich LLM prompts with source video context ([1828919](https://github.com/AmreetKumarkhuntia/video-clipper/commit/1828919736a7ff8d81645abb4d686d31d6855ddc))
* **clip-exporter:** add partial download mode, lossless remux, and clip output cache ([874c88f](https://github.com/AmreetKumarkhuntia/video-clipper/commit/874c88f98aed7667cc9f3eccb74ac1320407a87a))
* **logging:** add structured per-request logging with request ids ([f259034](https://github.com/AmreetKumarkhuntia/video-clipper/commit/f259034764dc8c51c5cfba3a41d13299998424e1))
* **publish-metadata:** add isShort toggle, metadata cache, and improved logging ([91a9970](https://github.com/AmreetKumarkhuntia/video-clipper/commit/91a99706a822fa1ef41741cf439a218f2b213e45)), closes [#Shorts](https://github.com/AmreetKumarkhuntia/video-clipper/issues/Shorts)
* **publish:** add workflow UI components and pages ([336d9b6](https://github.com/AmreetKumarkhuntia/video-clipper/commit/336d9b66718a302a27bdc0033c0635b1875dbd83))
* **publish:** add YouTube clip publishing pipeline with config defaults ([d45e9e7](https://github.com/AmreetKumarkhuntia/video-clipper/commit/d45e9e767cd4fbaa2bc154ca7a1f3630139a7998))
* **settings:** add dynamic config settings page with toast notifications ([6eee10a](https://github.com/AmreetKumarkhuntia/video-clipper/commit/6eee10a6f664b416b288a582e4f1937ca94e236e))
* **settings:** add textarea widget and PUBLISH_METADATA_SYSTEM_PROMPT ([645df35](https://github.com/AmreetKumarkhuntia/video-clipper/commit/645df35fb547fdb0447a87a1c3d3fb1b3d84c7f4))
* **web:** add SvelteKit web workbench shell and YouTube API integration ([7210e8a](https://github.com/AmreetKumarkhuntia/video-clipper/commit/7210e8ac51256de024675033b4f794644c4bbffd))
* **web:** refresh workspace layout and analysis activity flow ([91fa100](https://github.com/AmreetKumarkhuntia/video-clipper/commit/91fa100d79da6cd77cbed520066e218863b68aa6))
* **yt-dlp:** add extended download strategy config fields ([9c1dd5b](https://github.com/AmreetKumarkhuntia/video-clipper/commit/9c1dd5bfeb8d7ef37cbc71921d3b88166f3e1c97))
* **yt-dlp:** add quiet mode and configurable retry with exponential backoff ([f6f9463](https://github.com/AmreetKumarkhuntia/video-clipper/commit/f6f9463e2396cb0e88d1a1912c119209509eaa0e))


### Performance Improvements

* **analysis:** increase default web LLM concurrency to 3 ([84e1021](https://github.com/AmreetKumarkhuntia/video-clipper/commit/84e1021c3395d2282ef8a1f7fe8ca44a4f7f2e52))

# [1.7.0](https://github.com/AmreetKumarkhuntia/video-clipper/compare/v1.6.0...v1.7.0) (2026-03-30)


### Features

* **package:** add publishing metadata and contributor docs ([1add5e1](https://github.com/AmreetKumarkhuntia/video-clipper/commit/1add5e1107982aafa8e4a6876618290309d4c06a))

# [1.6.0](https://github.com/AmreetKumarkhuntia/video-clipper/compare/v1.5.6...v1.6.0) (2026-03-23)

### Features

- **cache:** add pluggable cache backend with MongoDB support ([b1c9d74](https://github.com/AmreetKumarkhuntia/video-clipper/commit/b1c9d74130b7154e54e566dea8279815c0021b97))

## [1.5.6](https://github.com/AmreetKumarkhuntia/video-clipper/compare/v1.5.5...v1.5.6) (2026-03-23)

### Bug Fixes

- **docs:** restructure README for npm package page ([97bc258](https://github.com/AmreetKumarkhuntia/video-clipper/commit/97bc25885f4756473ed45f080f201a9ce7dca365))

## [1.5.5](https://github.com/AmreetKumarkhuntia/video-clipper/compare/v1.5.4...v1.5.5) (2026-03-20)

### Bug Fixes

- **release:** skip npm publish when no new tag is created ([5ebe6c5](https://github.com/AmreetKumarkhuntia/video-clipper/commit/5ebe6c5629fbbc840185a930ab8d892cfc1c8693))

## [1.5.4](https://github.com/AmreetKumarkhuntia/video-clipper/compare/v1.5.3...v1.5.4) (2026-03-20)

### Bug Fixes

- **package:** include python scripts, add type defs, fix exports and bin ([e2b5398](https://github.com/AmreetKumarkhuntia/video-clipper/commit/e2b53987c6b1737cfb73265c325326aadbb277f9))

## [1.5.3](https://github.com/AmreetKumarkhuntia/video-clipper/compare/v1.5.2...v1.5.3) (2026-03-20)

### Bug Fixes

- **release:** use GITHUB_TOKEN and project-level .npmrc for GitHub Packages ([437234f](https://github.com/AmreetKumarkhuntia/video-clipper/commit/437234fe43edbf5e7e0ad5c1e9f21149bb589bb5))

## [1.5.2](https://github.com/AmreetKumarkhuntia/video-clipper/compare/v1.5.1...v1.5.2) (2026-03-20)

### Bug Fixes

- **release:** use PUSH_TOKEN for GitHub Packages auth ([eb89f64](https://github.com/AmreetKumarkhuntia/video-clipper/commit/eb89f64159f9903d5051587bb43e2e7f0c82c51a))

## [1.5.1](https://github.com/AmreetKumarkhuntia/video-clipper/compare/v1.5.0...v1.5.1) (2026-03-20)

### Bug Fixes

- **release:** use explicit --registry flag for GitHub Packages publish ([1aec842](https://github.com/AmreetKumarkhuntia/video-clipper/commit/1aec842846fa1308b50eba53fee6465a0dbbb958))

# [1.5.0](https://github.com/AmreetKumarkhuntia/video-clipper/compare/v1.4.0...v1.5.0) (2026-03-20)

### Features

- **release:** publish to GitHub Packages alongside npm ([dee2e57](https://github.com/AmreetKumarkhuntia/video-clipper/commit/dee2e574eceb83a43be47155ad87060d74658713))

# [1.4.0](https://github.com/AmreetKumarkhuntia/video-clipper/compare/v1.3.1...v1.4.0) (2026-03-20)

### Features

- **commitlint:** enforce conventional commit message format ([9d99882](https://github.com/AmreetKumarkhuntia/video-clipper/commit/9d998828617be72a81fbe4e72caa15eb28e88b82))

## [1.3.1](https://github.com/AmreetKumarkhuntia/video-clipper/compare/v1.3.0...v1.3.1) (2026-03-20)

### Bug Fixes

- **release:** add @semantic-release/npm plugin to update package.json version ([fe6498d](https://github.com/AmreetKumarkhuntia/video-clipper/commit/fe6498d779459455387e2ca2736862e704ea8b1c))
- **release:** add @semantic-release/npm to update package.json version ([9de3397](https://github.com/AmreetKumarkhuntia/video-clipper/commit/9de33977fe9f856aa8749436cbee7422dd622322))

# [1.3.0](https://github.com/AmreetKumarkhuntia/video-clipper/compare/v1.2.0...v1.3.0) (2026-03-19)

### Features

- **npm:** configure npm package publishing ([b268345](https://github.com/AmreetKumarkhuntia/video-clipper/commit/b26834559ce97db683c393db765d7d5c7e989236))

# [1.2.0](https://github.com/AmreetKumarkhuntia/video-clipper/compare/v1.1.1...v1.2.0) (2026-03-19)

### Features

- **docs:** add advanced examples section to README with common use cases ([6d730f6](https://github.com/AmreetKumarkhuntia/video-clipper/commit/6d730f615830247977273bacb26c9bee24a6e474))

## [1.1.1](https://github.com/AmreetKumarkhuntia/video-clipper/compare/v1.1.0...v1.1.1) (2026-03-19)

### Bug Fixes

- github workflows ([18a9536](https://github.com/AmreetKumarkhuntia/video-clipper/commit/18a953619ed17de71d3c9bd0a86e1b42a10aea37))
- **release:** pull updated package.json before npm publish to avoid race condition ([1839e4a](https://github.com/AmreetKumarkhuntia/video-clipper/commit/1839e4a57d516234ad629f0217e4fa5f4852e4e3))
- yaml correction ([33c7854](https://github.com/AmreetKumarkhuntia/video-clipper/commit/33c7854015e1266b3fc01b6206da4ec946f94307))

# 1.0.0 (2026-03-18)

### Bug Fixes

- **audio:** align audio chunk windows with transcript LLM chunks ([f81981f](https://github.com/AmreetKumarkhuntia/video-clipper/commit/f81981fdca8c8b4b13682112551541b1df75a138))
- **audio:** fix Gemini markdown fence parse error and add per-chunk caching ([3cc237f](https://github.com/AmreetKumarkhuntia/video-clipper/commit/3cc237f851c56236fb3f2795f5378b02cf34bde3))
- **audio:** fix Gemini MM.SS timestamp ambiguity and make model configurable ([2139c5f](https://github.com/AmreetKumarkhuntia/video-clipper/commit/2139c5fa2030679bb460b402108f0e64482c0d0b))
- **audio:** use python3 or python whichever available ([6501bf6](https://github.com/AmreetKumarkhuntia/video-clipper/commit/6501bf6ba99ba1364d285b7b921a22ecdfd23182))
- github workflows ([18a9536](https://github.com/AmreetKumarkhuntia/video-clipper/commit/18a953619ed17de71d3c9bd0a86e1b42a10aea37))
- **logging:** improve chunk analysis logs and gitignore outputs dir ([cc007de](https://github.com/AmreetKumarkhuntia/video-clipper/commit/cc007de0b1f453064a907689f9f30f6da2bebded))
- **release:** add explicit npm auth setup step ([21c9287](https://github.com/AmreetKumarkhuntia/video-clipper/commit/21c928748fe90f278e67e34ae57553e5c279faf2))
- **release:** add explicit npm auth setup step ([7e423fa](https://github.com/AmreetKumarkhuntia/video-clipper/commit/7e423fa76779d1dd6fe0d5bd0bac1cf0d54ffc8a))
- **release:** remove github release plugin, keep npm only ([b37870b](https://github.com/AmreetKumarkhuntia/video-clipper/commit/b37870bfe997ad9d16ec1e0c22d52a07c99b4aaf))
- **release:** restore github releases and fix git push permissions ([73e6fea](https://github.com/AmreetKumarkhuntia/video-clipper/commit/73e6fea88040844d00cebe79953f50f5ac96bc1e))
- **release:** use PUSH_TOKEN instead of GITHUB_TOKEN ([d3414ad](https://github.com/AmreetKumarkhuntia/video-clipper/commit/d3414ad84944d48bc5dfcee7562b00c358bca27e))
- **tests:** add global vitest setup to mock config module ([ecffd3b](https://github.com/AmreetKumarkhuntia/video-clipper/commit/ecffd3b940b4a2a3e5d0bd29911f2e70e22bdfe8))
- yaml correction ([33c7854](https://github.com/AmreetKumarkhuntia/video-clipper/commit/33c7854015e1266b3fc01b6206da4ec946f94307))

### Features

- **analysis:** add per-chunk evaluations to analysis dump ([c562878](https://github.com/AmreetKumarkhuntia/video-clipper/commit/c562878971c65b8739b373cf2cac235d5c6697c0))
- **audio:** add audio event result caching + requirements.txt ([5fd41d5](https://github.com/AmreetKumarkhuntia/video-clipper/commit/5fd41d5895e50060a93e9ef20621c85db52e80c4))
- **audio:** add openai-whisper as local audio event detector ([12aa5be](https://github.com/AmreetKumarkhuntia/video-clipper/commit/12aa5be9a5521efef07e29f20ea93dd1a54aeda6))
- **audio:** apply --max-parallel to audio event detection ([4996fc7](https://github.com/AmreetKumarkhuntia/video-clipper/commit/4996fc744f5000b791ecdd6677c95c24d5cf8e59))
- **cache:** add chunk/transcript caching and format timestamps as HH:MM:SS ([4ea921d](https://github.com/AmreetKumarkhuntia/video-clipper/commit/4ea921d409c2b8cda2a1a5d59eb8bec14ca2c919))
- **cache:** write chunk cache immediately after LLM analysis ([2ef3454](https://github.com/AmreetKumarkhuntia/video-clipper/commit/2ef3454a57c61abd5e0031639d6b79a726c7f413))
- **ci:** add semantic-release for automated versioning ([0b7b6b6](https://github.com/AmreetKumarkhuntia/video-clipper/commit/0b7b6b65f685f486f3b51d21a78ac63108b87695))
- **clip-generator:** add CLIP_CONCURRENCY config to prevent memory spikes ([be2c8af](https://github.com/AmreetKumarkhuntia/video-clipper/commit/be2c8af7763c5967b9b88d0b4406ac1a2c50af71))
- **clip:** fix audio/video sync and add flexible download options ([c8ebe1a](https://github.com/AmreetKumarkhuntia/video-clipper/commit/c8ebe1a7f2218dcb881d10bd421e7b77b84009b6))
- **llm:** add multi-provider support via modelFactory ([d72cb81](https://github.com/AmreetKumarkhuntia/video-clipper/commit/d72cb81d8adfe6366b60ef8ab74bbd7c38f67fe5))
- **llm:** support custom system prompt via LLM_SYSTEM_PROMPT env var ([8b4525d](https://github.com/AmreetKumarkhuntia/video-clipper/commit/8b4525d9fffe2806c2232035b9a8553e56f37270))
- **npm:** convert to scoped package @thunderkiller/video-clipper ([c8bf930](https://github.com/AmreetKumarkhuntia/video-clipper/commit/c8bf930c789cd9ceee3d8143fc5ff75674609f9a))
- **output:** add transcript and analysis dump feature ([15db23c](https://github.com/AmreetKumarkhuntia/video-clipper/commit/15db23c77244b9db89604be463bccb97f6161987))
- **phase4:** add video downloader and clip generator modules ([5c1cbde](https://github.com/AmreetKumarkhuntia/video-clipper/commit/5c1cbdeabe84a65013f7d5a8f34b3c2c336097e0))
- **phase5:** add CLI flags, error handling, and progress logging ([36edf0a](https://github.com/AmreetKumarkhuntia/video-clipper/commit/36edf0a93da5389c7d5dee555fb6e3c7c7e47ee1))
- **pipeline:** implement phase 2 core pipeline modules ([957b068](https://github.com/AmreetKumarkhuntia/video-clipper/commit/957b068a36dc29552c1a950ac74a8e337f097764))
- **pipeline:** implement phase 3 LLM analysis and metadata modules ([8a088c9](https://github.com/AmreetKumarkhuntia/video-clipper/commit/8a088c99498824b35c9e348dd1ef8bb01eba7659))
- **provider:** add custom OpenAI-compatible provider support ([5dc0c4e](https://github.com/AmreetKumarkhuntia/video-clipper/commit/5dc0c4e5fedddc97ba7907d5af89ba2fa46f2bc3))
- **provider:** add openrouter support and free models doc ([e41d4a6](https://github.com/AmreetKumarkhuntia/video-clipper/commit/e41d4a6780dc5d72e83aafd1a1b4b8a46f2dd284))
- **refiner:** add concurrency control and caching to segment refinement ([0738599](https://github.com/AmreetKumarkhuntia/video-clipper/commit/073859948700da0d59b806e29f03e9b7956f704d))
- **release:** split into two sequential stages - GitHub then npm ([9f6d110](https://github.com/AmreetKumarkhuntia/video-clipper/commit/9f6d1108abd80cacf695d3872f4800fb84884bdd))
- **scaffold:** bootstrap project structure and core infrastructure ([b187b3f](https://github.com/AmreetKumarkhuntia/video-clipper/commit/b187b3f43082ae88525f9444e84297b975167720))
- **tooling:** add prettier, husky pre-commit hooks, and github actions ci ([fdbdc9a](https://github.com/AmreetKumarkhuntia/video-clipper/commit/fdbdc9a838e083d2777e6c6fb0f700b28fb1c324))
- **version:** updated version ([69164f5](https://github.com/AmreetKumarkhuntia/video-clipper/commit/69164f59acca2e3236b4ab9a6e85441f89df01b4))
- **yt-dlp:** add cookie support and improve error logging ([ae4afd4](https://github.com/AmreetKumarkhuntia/video-clipper/commit/ae4afd476b4176645bd69f40a62f22fd775356eb))
