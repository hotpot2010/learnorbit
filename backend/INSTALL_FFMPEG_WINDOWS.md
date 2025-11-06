# 📦 Windows 手动安装 FFmpeg 教程

## 🎯 快速安装（5分钟）

### 步骤 1: 下载 FFmpeg

**官方下载地址**：
```
https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
```

或者备用地址：
```
https://github.com/BtbN/FFmpeg-Builds/releases
```

**推荐下载**：
- `ffmpeg-release-essentials.zip`（约 80MB）
- 或 `ffmpeg-master-latest-win64-gpl.zip`（最新版本）

### 步骤 2: 解压文件

1. 下载完成后，解压 zip 文件
2. 将解压后的文件夹重命名为 `ffmpeg`
3. 移动到 `C:\` 驱动器：
   ```
   C:\ffmpeg\
   ```

解压后的目录结构应该是：
```
C:\ffmpeg\
├── bin\
│   ├── ffmpeg.exe  ← 这是我们需要的
│   ├── ffplay.exe
│   └── ffprobe.exe
├── doc\
└── presets\
```

### 步骤 3: 添加到系统环境变量

#### 方法 A: 图形界面（推荐）

1. **打开环境变量设置**：
   - 按 `Win + X`，选择"系统"
   - 或右键"此电脑" → "属性"
   - 点击"高级系统设置"
   - 点击"环境变量"按钮

2. **编辑 Path 变量**：
   - 在"系统变量"区域，找到 `Path` 变量
   - 点击"编辑"
   - 点击"新建"
   - 输入：`C:\ffmpeg\bin`
   - 点击"确定"保存所有窗口

3. **重启终端**：
   - 关闭所有 PowerShell/命令提示符窗口
   - 重新打开一个新窗口

#### 方法 B: PowerShell 命令（管理员）

```powershell
# 以管理员身份运行 PowerShell，然后执行：
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\ffmpeg\bin", "Machine")
```

### 步骤 4: 验证安装

打开**新的** PowerShell 窗口，运行：
```powershell
ffmpeg -version
```

**预期输出**：
```
ffmpeg version 2024.11.06-git-xyz-essentials_build
Copyright (c) 2000-2024 the FFmpeg developers
...
```

如果看到版本信息 → ✅ **安装成功！**

---

## 🚨 常见问题

### 问题 1: "找不到 ffmpeg"

**原因**：环境变量未生效

**解决**：
1. ✅ 确认文件路径正确：`C:\ffmpeg\bin\ffmpeg.exe` 存在
2. ✅ 重启 PowerShell（必须是新窗口）
3. ✅ 如果还不行，**重启电脑**

### 问题 2: "权限被拒绝"

**解决**：
- 右键 PowerShell → "以管理员身份运行"
- 或者确保 `C:\ffmpeg` 文件夹有读取权限

### 问题 3: 环境变量设置后仍无效

**检查**：
```powershell
# 查看当前 Path 变量
$env:Path -split ';' | Select-String ffmpeg
```

**应该输出**：
```
C:\ffmpeg\bin
```

如果没有，重新添加环境变量。

---

## ⚡ 快速测试

安装完成后，测试视频下载：

```bash
cd D:\learnorbit\learnorbit\backend
python test_audio_merge.py
```

---

## 🎯 完整安装步骤（图解）

### 1️⃣ 下载
![下载 FFmpeg](https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip)

### 2️⃣ 解压到 C:\ffmpeg
```
下载 → 解压 → 重命名为 ffmpeg → 移动到 C:\
```

### 3️⃣ 添加环境变量
```
Win + X → 系统 → 高级 → 环境变量 → Path → 新建 → C:\ffmpeg\bin → 确定
```

### 4️⃣ 验证
```powershell
# 关闭旧窗口，打开新 PowerShell
ffmpeg -version
```

---

## 📝 备选方案：使用 winget（Windows 11）

如果您使用 Windows 11 或更新的 Windows 10：

```powershell
winget install ffmpeg
```

---

## ✅ 安装成功后

1. **重启后端服务**：
   ```bash
   cd D:\learnorbit\learnorbit\backend
   python main.py
   ```

2. **测试视频分析**：
   - 现在下载的视频应该包含音频了
   - 音视频会自动合并

3. **验证**：
   ```bash
   python test_audio_merge.py
   ```

---

## 🆘 如果所有方法都失败

使用**临时解决方案**（不需要 FFmpeg）：

当前代码已优化，会优先尝试下载已合并的格式：
- ✅ 使用 `best` 格式（无需 FFmpeg）
- ⚠️ 某些视频可能仍然无音频

但对于 **Gemini AI 分析**，无音频视频也完全可用！

---

**需要帮助？** 遇到问题请告诉我具体的错误信息！


