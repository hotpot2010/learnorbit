"""
测试 CUSTOM AnalysisType 修复
"""
from app.models.video import AnalysisType

def main():
    print("="*70)
    print("🧪 测试 AnalysisType.CUSTOM 修复")
    print("="*70)
    
    # 测试所有枚举值
    print("\n📋 可用的 AnalysisType 值:\n")
    
    for analysis_type in AnalysisType:
        print(f"   ✅ {analysis_type.name:15} = '{analysis_type.value}'")
    
    # 测试 CUSTOM 类型
    print("\n" + "="*70)
    print("🎯 测试 CUSTOM 类型")
    print("="*70)
    
    try:
        custom_type = AnalysisType.CUSTOM
        print(f"\n✅ AnalysisType.CUSTOM 存在!")
        print(f"   名称: {custom_type.name}")
        print(f"   值: {custom_type.value}")
        
        # 测试在字典中使用
        test_dict = {
            AnalysisType.CUSTOM: "自定义分析"
        }
        print(f"\n✅ 可以在字典中使用 CUSTOM 作为 key")
        print(f"   {test_dict[AnalysisType.CUSTOM]}")
        
        # 测试字符串比较
        if custom_type == "custom":
            print(f"\n✅ 可以与字符串 'custom' 比较")
        
        print("\n" + "="*70)
        print("🎉 所有测试通过！")
        print("="*70)
        
        print("\n💡 现在可以使用 AnalysisType.CUSTOM 了！")
        print("\n使用示例:")
        print("""
from app.services.gemini_service import GeminiService
from app.models.video import AnalysisType

service = GeminiService()
result = service.analyze_video(
    video_path="video.mp4",
    analysis_type=AnalysisType.CUSTOM,
    custom_prompt="你的自定义提示词..."
)
        """)
        
    except AttributeError as e:
        print(f"\n❌ 错误: {e}")
        print("   AnalysisType.CUSTOM 仍然不存在")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())


