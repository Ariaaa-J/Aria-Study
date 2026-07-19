# Aria Study — Markdown to Card Image

将知识笔记导出为小红书风格的卡片图片。

## 使用流程

### 1. 导出笔记为 Markdown
在 Aria Study 应用中打开笔记 → 点击「📥 导出」按钮 → 下载 `.md` 文件

### 2. 渲染为卡片图片
```bash
cd tools/markdown-to-image
./export-note.sh /path/to/笔记.md --theme dark
```

### 参数
| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--theme` | light / dark / warm / forest | light |
| `--font` | sans / serif | sans |
| `--scale` | 缩放倍率 (2/4/6/8) | 8 |

### 示例
```bash
# 暗色主题
./export-note.sh ~/Downloads/笔记.md --theme dark

# 暖色 + 衬线字体
./export-note.sh ~/Downloads/笔记.md --theme warm --font serif
```

输出 PNG 文件保存在笔记所在目录。
