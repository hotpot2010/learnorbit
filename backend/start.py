"""
Development server startup script
"""
import subprocess
import sys
import os

def main():
    """Start the development server"""
    print("🚀 Starting Video Analysis API Development Server...")
    
    # Check if virtual environment is activated
    if not hasattr(sys, 'real_prefix') and not sys.base_prefix != sys.prefix:
        print("⚠️  Warning: Virtual environment not detected")
        print("   Consider activating venv: venv\\Scripts\\activate (Windows) or source venv/bin/activate (Linux/Mac)")
    
    # Check if .env file exists
    if not os.path.exists('.env'):
        print("⚠️  Warning: .env file not found")
        print("   Copy env.example to .env and configure your API keys")
    
    try:
        # Start uvicorn server
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "main:app", 
            "--reload", 
            "--host", "0.0.0.0", 
            "--port", "8000",
            "--no-access-log"  # 禁用访问日志
        ], check=True)
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"❌ Server failed to start: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
