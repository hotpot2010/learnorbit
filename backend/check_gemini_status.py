"""
Gemini API状态检查工具
"""
import os
import google.generativeai as genai
from dotenv import load_dotenv

def check_gemini_status():
    """检查Gemini API状态"""
    print("🔍 检查Gemini API状态...")
    
    # 加载环境变量
    load_dotenv()
    api_key = os.getenv('GEMINI_API_KEY')
    
    if not api_key:
        print("❌ GEMINI_API_KEY未设置")
        return False
    
    try:
        # 配置API
        genai.configure(api_key=api_key)
        
        # 测试基础功能
        print("📋 测试模型列表...")
        models = genai.list_models()
        available_models = [m.name for m in models if 'generateContent' in m.supported_generation_methods]
        print(f"✅ 可用模型: {len(available_models)}个")
        for model in available_models[:3]:  # 显示前3个
            print(f"   - {model}")
        
        # 测试文本生成
        print("\n💬 测试文本生成...")
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content("Hello, 请用中文回复")
        print(f"✅ 文本生成成功: {response.text[:50]}...")
        
        # 测试文件上传API状态
        print("\n📤 检查文件上传API状态...")
        try:
            # 尝试列出已上传的文件
            files = genai.list_files()
            print(f"✅ 文件上传API可用，当前文件数: {len(list(files))}")
        except Exception as e:
            if "503" in str(e) or "Service Unavailable" in str(e):
                print("❌ 文件上传API不可用 (503 Service Unavailable)")
                print("   可能原因:")
                print("   1. API配额已用完")
                print("   2. 服务正在维护")
                print("   3. 地区限制")
                return False
            else:
                print(f"⚠️ 文件上传API异常: {e}")
        
        print("\n🎉 Gemini API状态正常！")
        return True
        
    except Exception as e:
        print(f"❌ Gemini API检查失败: {e}")
        
        # 提供具体的解决建议
        error_msg = str(e).lower()
        if "invalid" in error_msg and "key" in error_msg:
            print("\n💡 解决建议:")
            print("1. 检查GEMINI_API_KEY是否正确")
            print("2. 确认API密钥有效且未过期")
            print("3. 访问 https://aistudio.google.com/ 获取新密钥")
        elif "quota" in error_msg or "limit" in error_msg:
            print("\n💡 解决建议:")
            print("1. 检查API配额使用情况")
            print("2. 等待配额重置（通常每天重置）")
            print("3. 考虑升级到付费计划")
        elif "503" in error_msg:
            print("\n💡 解决建议:")
            print("1. 稍后重试，可能是临时服务问题")
            print("2. 检查网络连接")
            print("3. 尝试使用VPN（如果在受限地区）")
        
        return False

if __name__ == "__main__":
    check_gemini_status()







