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
