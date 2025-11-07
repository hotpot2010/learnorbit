# 视频截图 CORS 问题修复说明

## 问题描述

在实现视频笔记功能时，尝试使用 Canvas 捕获视频截图时遇到以下错误：

```
Error: Failed to execute 'toDataURL' on 'HTMLCanvasElement': Tainted canvases may not be exported.
```

## 问题原因

这是一个浏览器安全机制（CORS - Cross-Origin Resource Sharing）导致的问题：

1. **Canvas 污染 (Tainted Canvas)**:
   - 当视频来源（CDN链接）与网页域名不同时
   - 浏览器会将 Canvas 标记为"污染"状态
   - 污染的 Canvas 无法使用 `toDataURL()` 或 `toBlob()` 导出图片

2. **为什么会污染**:
   - 防止恶意网站读取跨域媒体内容
   - 保护用户隐私和版权内容
   - 是浏览器的标准安全策略

## 解决方案

### 方案1: 添加 `crossOrigin` 属性（推荐）✅

在 `<video>` 元素上添加 `crossOrigin="anonymous"` 属性：

```tsx
<video
  ref={videoRef}
  src={cdnVideoUrl}
  crossOrigin="anonymous"  // ✅ 关键属性
  controls
  onPlay={() => setIsPlaying(true)}
  onPause={() => setIsPlaying(false)}
  onTimeUpdate={handleTimeUpdate}
>
  您的浏览器不支持 video 标签。
</video>
```

**前提条件**：视频服务器必须正确设置 CORS 响应头：
```
Access-Control-Allow-Origin: *
或
Access-Control-Allow-Origin: https://your-domain.com
```

### 方案2: 添加错误处理（当前实现）✅

如果服务器不支持 CORS，笔记功能仍然可用，只是没有缩略图：

```typescript
const captureVideoThumbnail = (): string => {
  if (!videoRef.current) return '';
  
  try {
    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      try {
        // 尝试导出图片
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        console.log('✅ Screenshot captured successfully');
        return dataUrl;
      } catch (error) {
        // CORS 错误，返回空字符串
        console.error('❌ Canvas toDataURL error (CORS issue):', error);
        return '';  // 笔记仍然生成，只是没有缩略图
      }
    }
  } catch (error) {
    console.error('❌ Screenshot capture error:', error);
  }
  
  return '';
};
```

### 方案3: 服务端代理（如果方案1不可行）

如果CDN不支持CORS，可以通过后端代理视频：

1. 创建后端端点：`/api/video-proxy?url=xxx`
2. 后端下载视频并返回
3. 前端使用代理后的URL
4. 缺点：增加服务器带宽和延迟

### 方案4: 使用视频第一帧作为封面（备选方案）

如果无法捕获当前帧，可以使用视频的 `poster` 属性或第一帧：

```tsx
<video
  poster={videoPosterUrl}  // 使用视频封面图
  ...
/>
```

## 当前实现状态

✅ **已实现**:
1. 添加 `crossOrigin="anonymous"` 到 `<video>` 元素
2. 在 `captureVideoThumbnail()` 中添加 try-catch 错误处理
3. 即使截图失败，笔记生成功能仍然正常工作
4. 在控制台输出清晰的日志信息

✅ **优雅降级**:
- 如果截图成功 → 笔记包含缩略图
- 如果截图失败（CORS） → 笔记正常生成，只是没有缩略图
- 用户体验不受影响，只是视觉效果略有差异

## 后端配置建议

如果你控制视频CDN服务器，建议添加以下响应头：

### Nginx 配置
```nginx
location /videos/ {
    add_header 'Access-Control-Allow-Origin' '*';
    add_header 'Access-Control-Allow-Methods' 'GET, HEAD, OPTIONS';
    add_header 'Access-Control-Allow-Headers' 'Range';
}
```

### Apache 配置
```apache
<Directory "/var/www/videos">
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET, HEAD, OPTIONS"
</Directory>
```

### Express.js (Node.js)
```javascript
app.use('/videos', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  next();
});
```

## 测试方法

### 1. 测试 CORS 是否生效

在浏览器控制台运行：

```javascript
fetch('http://file.gsxservice.com/your-video.mp4', { 
  method: 'HEAD' 
})
.then(response => {
  console.log('CORS headers:', response.headers.get('access-control-allow-origin'));
})
.catch(err => console.error('CORS error:', err));
```

### 2. 测试视频截图

```javascript
const video = document.querySelector('video');
const canvas = document.createElement('canvas');
canvas.width = video.videoWidth;
canvas.height = video.videoHeight;
const ctx = canvas.getContext('2d');
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

try {
  const dataUrl = canvas.toDataURL('image/jpeg');
  console.log('✅ Screenshot works!', dataUrl.substring(0, 50));
} catch (error) {
  console.error('❌ Screenshot failed (CORS):', error);
}
```

## 相关资源

- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [HTML5 Video CORS](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image)
- [Canvas Security](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Using_images#security_and_tainted_canvases)

## 总结

当前实现采用了**双重保护策略**：

1. ✅ 添加 `crossOrigin="anonymous"` - 尝试启用CORS
2. ✅ 添加错误处理 - 即使CORS失败也不影响核心功能

这样确保了：
- 最佳情况：视频截图正常工作，笔记包含缩略图
- 降级情况：笔记仍然生成，只是没有缩略图
- 用户体验：核心功能（笔记生成）始终可用

