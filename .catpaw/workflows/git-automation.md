---
description: 自动化 Git 提交流程，不仅包括 add/commit/push，还要求 AI 能够根据本次变更的 `git diff` 自动提炼并生成高质量的 commit message。
---

# Advanced Git Automation (with Auto-Summary)

**Intention & Goal**: 自动化 Git 提交流程，不仅包括 add/commit/push，还要求 AI 能够根据本次变更的 `git diff` 自动提炼并生成高质量的 commit message。

## Command Set

### 探索与分析阶段 (Explore & Analyze)
```bash
# 查看变更摘要，为 AI 提炼 commit message 提供输入
git status && git diff --cached --stat
```

### 提炼与提交阶段 (Implementation with Auto-Summary)
> [!NOTE]
> 在执行以下指令前，请确保已将文件 add 到暂存区。您可以要求 AI 助手：“请分析我的 git diff 并生成一个精炼的 commit message，然后执行提交”。

```bash
# 核心指令逻辑（在 AI 环境下执行）
git add . && git commit -m "$(git diff --cached --name-only | tr '\n' ',' | sed 's/,$//' | xargs -I {} echo "update: Modified {}")" && git push
```

### 推荐工作流 (Recommended Workflow)
1. **暂存**: `git add .`
2. **提炼**: 调用 AI 助手查看 `git diff --cached` 并总结变更。
3. **提交**: `git commit -m "AI_GENERATED_SUMMARY"`
4. **推送**: `git push`

## Usage Guide
- **自动提炼**: 如果您正在使用集成 AI 的工具（如 Cursor/Antigravity），可以直接输入指令：“根据当前 diff 生成 commit message 并提交推送”。
- **手动补全**: 如果使用普通终端，推荐先运行 `git diff --stat` 观察变更点，再手动撰写摘要。
- **安全性**: 建议在推送前通过 `git status` 确认没有误删或多余文件。
