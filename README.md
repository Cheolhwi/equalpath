# EqualPath Iteration 1 Demo Snapshot

这是 2026 年 8 月 30 日完成并验证的 EqualPath Iteration 1 独立演示快照。它用于稳定演示、审阅和恢复；后续 Iteration 2 开发应继续在上一级主工作区进行，不要直接修改这个目录。

## 最安全的演示方式

1. 用 Xcode 打开 `equalpath/EqualPath.xcodeproj`。
2. 选择共享 Scheme `EqualPath Iteration 1 Demo`。
3. 选择一个 iPhone 模拟器并运行。

该 Scheme 会自动加入 `-EqualPathPreviewMain`，直接进入本地 Preview。Preview 使用内置示例数据，不登录 Google、不写入 Appwrite、不发送外部消息，也不建立云端通知。

如果希望演示首次进入流程，可改用标准 `EqualPath` Scheme，在欢迎页选择 **Preview without signing in**。不要在标准 Scheme 中登录并修改现有 Appwrite owner 数据，除非该操作已经得到明确授权。

## 快照内容

- `equalpath/`：可构建的 SwiftUI iOS 工程、测试、字体、设计 QA 截图，以及固定到 Appwrite Apple SDK 18.3.0 的 `Package.resolved`。
- `appwrite-backend/`：Iteration 1 Appwrite 配置、两个 Functions、34 项自动化测试和集成说明。
- `design-artifacts/`：最终的 3 Epic、10 User Story、31 AC Word 基线及 Iteration 1 HTML 规格。
- `design_handoff_equalpath_ios/`：Iteration 1 使用的 iOS 设计交付源。
- `ITERATION1_HANDOVER.md`：实现状态、已验证旅程、关键不变量、已知缺口和 Iteration 2 起点。
- `SHA256SUMS`：除该清单自身以外，每个快照文件的 SHA-256 校验值。

编译缓存、`node_modules`、`.env`、Appwrite 本地状态、Xcode 用户状态和 `.DS_Store` 均未纳入快照。依赖可由锁文件重新安装。

## 验证基线

快照创建前已重新验证：

- 演示 Scheme 的 iOS Simulator Debug build：通过（Xcode 26.6）。
- 演示快照的 iOS `CoverageSummaryTests`：15 通过，0 失败。
- 后端配置：15 张表、168 个字段、37 个索引、2 个 Functions；通过。
- 演示快照的后端自动化测试：34 通过，0 失败。
- 完整 Iteration 1 旅程和验收证据见 `ITERATION1_HANDOVER.md`。

## 恢复与重新验证

iOS：打开 `equalpath/EqualPath.xcodeproj`，等待 Swift Package 依赖解析后运行 `EqualPath Iteration 1 Demo`。

后端：

```sh
cd appwrite-backend
npm install
npm run check
npm test
```

完整性校验：

```sh
shasum -a 256 -c SHA256SUMS
```

## 已知边界

Possible paths 与 People 仍是静态/只读演示界面；真实计划生成、发送、照护者确认和云推送不属于 Iteration 1。所有后续开发必须继续保留 `unknown` 安全状态、owner 隔离、幂等物化/扫描，以及失败扫描不得清除最后已验证冲突的约束。
