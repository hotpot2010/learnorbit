"""
专门诊断 BV1Jgf6YvE8e 这个视频的脚本
"""
import yt_dlp
import tempfile
import os

def diagnose_video():
    url = "https://www.bilibili.com/video/BV1Jgf6YvE8e"
    
    print("="*70)
    print("🔍 详细诊断 BV1Jgf6YvE8e")
    print("="*70)
    print(f"URL: {url}\n")
    
    # Step 1: 基本信息提取
    print("📋 Step 1: 提取基本信息...")
    print("-"*70)
    
    ydl_opts_info = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
            info = ydl.extract_info(url, download=False)
            
            print(f"✅ 视频信息:")
            print(f"   标题: {info.get('title', 'N/A')}")
            print(f"   BV号: {info.get('id', 'N/A')}")
            print(f"   时长: {info.get('duration', 0)} 秒 ({info.get('duration', 0)//60} 分钟)")
            print(f"   UP主: {info.get('uploader', 'N/A')}")
            print(f"   播放: {info.get('view_count', 0):,}")
            print(f"   点赞: {info.get('like_count', 0):,}")
            
            # 检查是否是多P视频
            if 'entries' in info:
                print(f"\n   ⚠️  这是一个多P视频/合集，包含 {len(info['entries'])} 个分集")
                print(f"   建议: 下载单个分集，例如:")
                print(f"   https://www.bilibili.com/video/BV1Jgf6YvE8e?p=1")
            
            # 检查是否需要登录
            if info.get('is_live'):
                print(f"\n   ⚠️  这是直播内容")
            
            # 显示可用格式
            if 'formats' in info:
                print(f"\n   📊 可用格式数量: {len(info['formats'])}")
                
                # 分析格式
                video_formats = [f for f in info['formats'] if f.get('vcodec', 'none') != 'none']
                audio_formats = [f for f in info['formats'] if f.get('acodec', 'none') != 'none' and f.get('vcodec', 'none') == 'none']
                
                print(f"   - 视频格式: {len(video_formats)}")
                print(f"   - 音频格式: {len(audio_formats)}")
                
                # 显示前几个格式
                print(f"\n   前5个可用格式:")
                for i, fmt in enumerate(info['formats'][:5], 1):
                    format_id = fmt.get('format_id', 'N/A')
                    ext = fmt.get('ext', 'N/A')
                    resolution = fmt.get('resolution', 'N/A')
                    vcodec = fmt.get('vcodec', 'none')
                    acodec = fmt.get('acodec', 'none')
                    filesize = fmt.get('filesize', 0)
                    
                    size_str = f"{filesize / 1024 / 1024:.1f}MB" if filesize else "未知"
                    
                    print(f"   {i}. ID:{format_id:8} | {ext:5} | {resolution:12} | "
                          f"视频:{vcodec:12} | 音频:{acodec:12} | {size_str}")
                
    except Exception as e:
        print(f"❌ 提取信息失败: {e}")
        return
    
    # Step 2: 测试不同的下载策略
    print("\n" + "="*70)
    print("🧪 Step 2: 测试不同下载策略")
    print("="*70)
    
    temp_dir = tempfile.gettempdir()
    print(f"临时目录: {temp_dir}\n")
    
    strategies = [
        ("默认 best", {'format': 'best'}),
        ("最低质量 worst", {'format': 'worst'}),
        ("仅视频 bestvideo", {'format': 'bestvideo'}),
        ("仅音频 bestaudio", {'format': 'bestaudio'}),
        ("格式ID 64 (常见)", {'format': '64'}),
        ("格式ID 32 (常见)", {'format': '32'}),
        ("格式ID 16 (最低)", {'format': '16'}),
    ]
    
    successful_strategy = None
    
    for i, (name, opts) in enumerate(strategies, 1):
        print(f"\n[{i}/{len(strategies)}] 尝试: {name}")
        print(f"   格式参数: {opts['format']}")
        
        ydl_opts = {
            'format': opts['format'],
            'outtmpl': os.path.join(temp_dir, f'test_bilibili_{opts["format"]}.%(ext)s'),
            'quiet': True,
            'no_warnings': True,
            'socket_timeout': 30,
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)  # 先不真正下载
                
                # 检查这个格式是否可用
                print(f"   ✅ 格式 '{opts['format']}' 可用!")
                
                if not successful_strategy:
                    successful_strategy = (name, opts)
                    print(f"   ⭐ 这个策略可以使用!")
                
        except Exception as e:
            error_str = str(e)
            if 'Requested format is not available' in error_str:
                print(f"   ❌ 格式不可用")
            elif 'format' in error_str.lower():
                print(f"   ❌ 格式问题: {error_str[:50]}...")
            else:
                print(f"   ❌ 其他错误: {error_str[:50]}...")
    
    # Step 3: 推荐方案
    print("\n" + "="*70)
    print("💡 诊断结果和建议")
    print("="*70)
    
    if successful_strategy:
        name, opts = successful_strategy
        print(f"\n✅ 找到可用的下载策略: {name}")
        print(f"\n推荐配置:")
        print(f"```python")
        print(f"ydl_opts = {{")
        print(f"    'format': '{opts['format']}',")
        print(f"    'outtmpl': 'output.%(ext)s',")
        print(f"    'quiet': False,")
        print(f"}}```")
    else:
        print(f"\n❌ 所有标准策略都失败了")
        print(f"\n可能的原因:")
        print(f"   1. 这是付费/会员专享内容")
        print(f"   2. 需要登录 B站账号 (Cookie)")
        print(f"   3. 地区限制")
        print(f"   4. DRM 保护")
        print(f"\n建议:")
        print(f"   1. 使用 B站登录后的 Cookie")
        print(f"      - 在浏览器登录 B站")
        print(f"      - 导出 Cookie 文件")
        print(f"      - 在 ydl_opts 中添加: 'cookiefile': 'cookies.txt'")
        print(f"\n   2. 尝试其他相似的免费视频")
        print(f"\n   3. 使用命令行手动测试:")
        print(f"      yt-dlp --list-formats '{url}'")
        print(f"      yt-dlp -f best --cookies cookies.txt '{url}'")
    
    print("\n" + "="*70)
    print("📝 完整的格式列表命令:")
    print(f"   yt-dlp --list-formats '{url}'")
    print("="*70)

if __name__ == "__main__":
    diagnose_video()


