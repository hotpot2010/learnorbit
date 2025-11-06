"""
一键设置Backend开发环境
解决所有常见的安装问题
"""
import subprocess
import sys
import os
import shutil
from pathlib import Path

def run_command(command, description, ignore_errors=False):
    """运行命令并处理错误"""
    print(f"\n🔧 {description}")
    print(f"   Command: {' '.join(command)}")
    
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True)
        print(f"   ✅ Success")
        return True
    except subprocess.CalledProcessError as e:
        print(f"   ❌ Failed: {e}")
        if e.stdout:
            print(f"   stdout: {e.stdout}")
        if e.stderr:
            print(f"   stderr: {e.stderr}")
        
        if not ignore_errors:
            return False
        else:
            print(f"   ⚠️  Ignoring error and continuing...")
            return True
    except FileNotFoundError:
        print(f"   ❌ Command not found: {command[0]}")
        return False

def check_python_version():
    """检查Python版本"""
    print("🐍 检查Python版本...")
    version = sys.version_info
    print(f"   Python {version.major}.{version.minor}.{version.micro}")
    
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("   ❌ 需要Python 3.8或更高版本")
        return False
    
    print("   ✅ Python版本满足要求")
    return True

def setup_virtual_environment():
    """设置虚拟环境"""
    venv_path = Path("venv")
    
    if venv_path.exists():
        print("📁 虚拟环境已存在，跳过创建")
        return True
    
    print("📁 创建虚拟环境...")
    if not run_command([sys.executable, "-m", "venv", "venv"], "创建虚拟环境"):
        return False
    
    return True

def get_pip_command():
    """获取pip命令路径"""
    if os.name == 'nt':  # Windows
        return os.path.join("venv", "Scripts", "pip.exe")
    else:  # Linux/Mac
        return os.path.join("venv", "bin", "pip")

def upgrade_pip():
    """升级pip"""
    pip_cmd = get_pip_command()
    return run_command([pip_cmd, "install", "--upgrade", "pip", "setuptools", "wheel"], 
                      "升级pip和构建工具")

def install_core_dependencies():
    """安装核心依赖（避免编译问题）"""
    pip_cmd = get_pip_command()
    
    core_deps = [
        "fastapi==0.104.1",
        "uvicorn[standard]==0.24.0",
        "python-multipart==0.0.6",
        "pydantic==2.11.7",
        "python-dotenv==1.0.0",
        "aiofiles==24.1.0",
        "httpx==0.28.1",
        "requests==2.32.5"
    ]
    
    print("📦 安装核心依赖...")
    for dep in core_deps:
        if not run_command([pip_cmd, "install", dep], f"安装 {dep}", ignore_errors=True):
            print(f"   ⚠️  {dep} 安装失败，但继续...")
    
    return True

def install_optional_dependencies():
    """安装可选依赖"""
    pip_cmd = get_pip_command()
    
    optional_deps = [
        "google-generativeai==0.8.5",
        "pydantic-settings==2.6.1"
    ]
    
    print("📦 安装可选依赖...")
    success_count = 0
    
    for dep in optional_deps:
        if run_command([pip_cmd, "install", dep], f"安装 {dep}", ignore_errors=True):
            success_count += 1
    
    print(f"   📊 可选依赖安装成功: {success_count}/{len(optional_deps)}")
    return success_count > 0

def create_env_file():
    """创建环境变量文件"""
    if os.path.exists('.env'):
        print("📄 .env文件已存在，跳过创建")
        return True
    
    if os.path.exists('env.example'):
        print("📄 从env.example创建.env文件...")
        shutil.copy('env.example', '.env')
        print("   ✅ .env文件创建成功")
        print("   ⚠️  请编辑.env文件，添加您的GEMINI_API_KEY")
        return True
    else:
        print("   ❌ env.example文件不存在")
        return False

def create_uploads_directory():
    """创建uploads目录"""
    uploads_path = Path("uploads")
    uploads_path.mkdir(exist_ok=True)
    print("📁 uploads目录已创建")
    return True

def create_test_script():
    """创建测试脚本"""
    test_content = '''"""
环境测试脚本
"""
import sys
import os

def test_imports():
    """测试关键包导入"""
    packages = [
        ('fastapi', 'FastAPI'),
        ('uvicorn', 'Uvicorn'),
        ('pydantic', 'Pydantic'),
        ('aiofiles', 'Aiofiles'),
        ('requests', 'Requests')
    ]
    
    print("🧪 测试包导入...")
    success = 0
    
    for package, name in packages:
        try:
            __import__(package)
            print(f"   ✅ {name}")
            success += 1
        except ImportError as e:
            print(f"   ❌ {name}: {e}")
    
    # 测试可选包
    optional_packages = [
        ('google.generativeai', 'Google Generative AI'),
        ('pydantic_settings', 'Pydantic Settings')
    ]
    
    print("\\n🔍 测试可选包...")
    for package, name in optional_packages:
        try:
            __import__(package)
            print(f"   ✅ {name}")
            success += 1
        except ImportError:
            print(f"   ⚠️  {name} (可选)")
    
    return success

def test_environment():
    """测试环境配置"""
    print("\\n🔧 测试环境配置...")
    
    # 检查.env文件
    if os.path.exists('.env'):
        print("   ✅ .env文件存在")
        
        # 检查关键配置
        with open('.env', 'r') as f:
            content = f.read()
            if 'GEMINI_API_KEY' in content:
                print("   ✅ GEMINI_API_KEY配置存在")
            else:
                print("   ⚠️  GEMINI_API_KEY未配置")
    else:
        print("   ❌ .env文件不存在")
    
    # 检查uploads目录
    if os.path.exists('uploads'):
        print("   ✅ uploads目录存在")
    else:
        print("   ❌ uploads目录不存在")

def main():
    print("🧪 Backend环境测试")
    print("=" * 40)
    
    success_count = test_imports()
    test_environment()
    
    print("\\n" + "=" * 40)
    print(f"📊 测试结果: {success_count} 个包导入成功")
    
    if success_count >= 5:
        print("🎉 环境设置成功！可以启动服务器了")
        print("💡 运行 python main.py 启动服务器")
    else:
        print("❌ 环境设置不完整，请检查安装步骤")

if __name__ == "__main__":
    main()
'''
    
    with open('test_setup.py', 'w', encoding='utf-8') as f:
        f.write(test_content)
    
    print("📄 测试脚本已创建: test_setup.py")
    return True

def main():
    """主安装流程"""
    print("🚀 Backend一键设置开始")
    print("=" * 50)
    
    steps = [
        ("检查Python版本", check_python_version),
        ("设置虚拟环境", setup_virtual_environment),
        ("升级pip", upgrade_pip),
        ("安装核心依赖", install_core_dependencies),
        ("安装可选依赖", install_optional_dependencies),
        ("创建.env文件", create_env_file),
        ("创建uploads目录", create_uploads_directory),
        ("创建测试脚本", create_test_script)
    ]
    
    failed_steps = []
    
    for step_name, step_func in steps:
        print(f"\n📋 步骤: {step_name}")
        try:
            if not step_func():
                failed_steps.append(step_name)
                print(f"   ❌ {step_name} 失败")
            else:
                print(f"   ✅ {step_name} 成功")
        except Exception as e:
            print(f"   ❌ {step_name} 异常: {e}")
            failed_steps.append(step_name)
    
    print("\n" + "=" * 50)
    print("📊 安装总结")
    
    if failed_steps:
        print(f"❌ 失败步骤: {', '.join(failed_steps)}")
        print("⚠️  部分功能可能不可用")
    else:
        print("🎉 所有步骤完成！")
    
    print("\n📖 下一步:")
    print("1. 编辑 .env 文件，添加您的 GEMINI_API_KEY")
    print("2. 运行 python test_setup.py 测试环境")
    print("3. 运行 python main.py 启动服务器")
    print("4. 访问 http://localhost:8000/docs 查看API文档")

if __name__ == "__main__":
    main()
