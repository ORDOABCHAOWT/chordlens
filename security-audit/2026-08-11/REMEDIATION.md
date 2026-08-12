# ChordLens 安全整改记录

本目录中的 Codex Security 报告记录的是整改前的源码快照，扫描 ID 为 `40cb4b46-78ca-44a8-8568-34bccdeb22a6`。扫描共确认 3 项问题：1 项中危、2 项低危。

## 已完成整改

- 麦克风生命周期：录音流现在由组件持有，并会在显式停止、录音错误、初始化失败、达到 15 分钟上限或切换工作区导致组件卸载时释放。
- 音频资源上限：导入文件限制为 100 MB、时长限制为 1 小时；校验常见音频容器头；同一窗口只允许一个分析任务。
- Basic Pitch 进程：增加 180 秒超时、8 MB 标准输出上限、64 KB 错误输出上限、文件类型与大小校验，以及 Python 侧时长和音符事件数量上限。
- WebAudio/Blob：`AudioContext` 在成功和失败路径都会关闭；替换播放音频时会撤销旧 Blob URL。
- 桌面加固：启用限制性 CSP，移除未使用的 macOS 私有 API，补充麦克风用途说明、音频输入 entitlement 和 Hardened Runtime 签名配置。

## 验证结果

- TypeScript 类型检查：通过
- ESLint：通过
- Vitest：10/10 通过
- Playwright：6/6 通过（含麦克风卸载释放、真实 WAV 导入、响应式单窗口和视觉回归）
- Rust `cargo check`：通过
- macOS release 构建：通过
- `codesign --verify --deep --strict`：通过
- 原生系统验证：仅 1 个窗口，可移动、可调整大小，使用系统窗口装饰和圆角

