"""
简单的视频分析测试脚本
"""
import requests
import time
import os

def test_video_analysis():
    """测试视频分析API"""
    base_url = "http://localhost:8000"
    
    print("🧪 开始视频分析测试...")
    
    # 1. 检查健康状态
    print("\n1️⃣ 检查API健康状态...")
    try:
        response = requests.get(f"{base_url}/api/v1/video/health", timeout=10)
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.json()}")
    except Exception as e:
        print(f"❌ 健康检查失败: {e}")
        return
    
    # 2. 检查分析类型
    print("\n2️⃣ 获取分析类型...")
    try:
        response = requests.get(f"{base_url}/api/v1/video/analysis-types", timeout=10)
        print(f"状态码: {response.status_code}")
        print(f"可用分析类型: {len(response.json().get('analysis_types', []))}")
    except Exception as e:
        print(f"❌ 获取分析类型失败: {e}")
        return
    
    # 3. 测试文件上传分析（如果有测试视频）
    test_video_path = input("\n3️⃣ 请输入测试视频文件路径（或按Enter跳过）: ").strip()
    
    if test_video_path and os.path.exists(test_video_path):
        print(f"📤 开始上传并分析视频: {test_video_path}")
        
        try:
            with open(test_video_path, 'rb') as video_file:
                files = {'file': video_file}
                data = {
                    'analysis_type': 'summary',  # 使用摘要分析，相对较快
                }
                
                print("⏳ 正在上传和分析，请耐心等待...")
                start_time = time.time()
                
                # 设置较长的超时时间
                response = requests.post(
                    f"{base_url}/api/v1/video/upload-and-analyze",
                    files=files,
                    data=data,
                    timeout=600  # 10分钟超时
                )
                
                elapsed_time = time.time() - start_time
                print(f"⏱️ 总耗时: {elapsed_time:.1f}秒")
                
                if response.status_code == 200:
                    result = response.json()
                    print("✅ 分析成功!")
                    print(f"分析类型: {result.get('analysis_type')}")
                    print(f"处理时间: {result.get('processing_time', 0):.1f}秒")
                    
                    if result.get('result', {}).get('content'):
                        content = result['result']['content']
                        print(f"分析结果预览: {content[:200]}...")
                    else:
                        print("⚠️ 没有分析内容")
                else:
                    print(f"❌ 分析失败: {response.status_code}")
                    print(f"错误信息: {response.text}")
                    
        except requests.exceptions.Timeout:
            print("❌ 请求超时，视频可能太大或处理时间过长")
        except Exception as e:
            print(f"❌ 上传分析失败: {e}")
    else:
        print("⏭️ 跳过文件上传测试")
    
    print("\n🎉 测试完成!")

if __name__ == "__main__":
    test_video_analysis()







