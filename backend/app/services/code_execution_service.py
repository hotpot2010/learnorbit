#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
代码执行服务
使用Docker容器在隔离环境中安全执行代码
"""

import asyncio
import tempfile
import os
import json
from pathlib import Path
from typing import Dict, Any, Optional
import subprocess


class CodeExecutionService:
    """代码执行服务"""
    
    def __init__(self):
        """初始化代码执行服务"""
        self.supported_languages = {
            'python': {
                'image': 'python:3.11-slim',
                'file_ext': '.py',
                'command': 'python'
            },
            'javascript': {
                'image': 'node:18-slim',
                'file_ext': '.js',
                'command': 'node'
            }
        }
        self.timeout = 10  # 执行超时时间（秒）
        self.memory_limit = '128m'  # 内存限制
        self.check_docker_available()
    
    def check_docker_available(self) -> bool:
        """检查Docker是否可用"""
        try:
            result = subprocess.run(
                ['docker', '--version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                print(f"✅ Docker可用: {result.stdout.strip()}")
                return True
            else:
                print("⚠️ Docker不可用，代码执行功能将受限")
                return False
        except Exception as e:
            print(f"⚠️ Docker检查失败: {e}")
            print("💡 提示：代码执行功能需要安装Docker")
            return False
    
    async def execute_code(
        self,
        code: str,
        language: str,
        test_inputs: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        执行代码
        
        Args:
            code: 要执行的代码
            language: 编程语言
            test_inputs: 测试输入列表
            
        Returns:
            执行结果字典
        """
        if language not in self.supported_languages:
            return {
                'success': False,
                'error': f'不支持的语言: {language}',
                'supported_languages': list(self.supported_languages.keys())
            }
        
        lang_config = self.supported_languages[language]
        
        # 检查Docker是否可用
        if not self.check_docker_available():
            # 如果Docker不可用，使用本地执行（仅Python，有风险）
            if language == 'python':
                return await self._execute_locally(code, test_inputs)
            else:
                return {
                    'success': False,
                    'error': 'Docker不可用，无法执行代码',
                    'hint': '请安装Docker以使用代码执行功能'
                }
        
        try:
            # 创建临时文件
            with tempfile.NamedTemporaryFile(
                mode='w',
                suffix=lang_config['file_ext'],
                delete=False,
                encoding='utf-8'
            ) as f:
                f.write(code)
                temp_file = f.name
            
            try:
                # 使用Docker执行代码
                result = await self._execute_in_docker(
                    temp_file,
                    lang_config,
                    test_inputs
                )
                return result
            finally:
                # 清理临时文件
                try:
                    os.unlink(temp_file)
                except:
                    pass
                    
        except Exception as e:
            return {
                'success': False,
                'error': f'执行失败: {str(e)}'
            }
    
    async def _execute_in_docker(
        self,
        file_path: str,
        lang_config: Dict[str, Any],
        test_inputs: Optional[list] = None
    ) -> Dict[str, Any]:
        """在Docker容器中执行代码"""
        try:
            # 构建Docker命令
            docker_cmd = [
                'docker', 'run',
                '--rm',  # 执行后删除容器
                '--network', 'none',  # 禁用网络
                '--memory', self.memory_limit,  # 内存限制
                '--cpus', '0.5',  # CPU限制
                '-v', f'{os.path.abspath(file_path)}:/code{lang_config["file_ext"]}:ro',  # 只读挂载
                lang_config['image'],
                lang_config['command'], f'/code{lang_config["file_ext"]}'
            ]
            
            print(f"🚀 执行Docker命令: {' '.join(docker_cmd)}")
            
            # 执行命令
            process = await asyncio.create_subprocess_exec(
                *docker_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                stdin=asyncio.subprocess.PIPE
            )
            
            # 如果有测试输入，传递给程序
            stdin_data = None
            if test_inputs:
                stdin_data = '\n'.join(str(x) for x in test_inputs).encode()
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(input=stdin_data),
                    timeout=self.timeout
                )
                
                output = stdout.decode('utf-8', errors='ignore')
                error = stderr.decode('utf-8', errors='ignore')
                
                return {
                    'success': process.returncode == 0,
                    'output': output,
                    'error': error if error else None,
                    'exit_code': process.returncode
                }
                
            except asyncio.TimeoutError:
                process.kill()
                return {
                    'success': False,
                    'error': f'执行超时（超过{self.timeout}秒）'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f'Docker执行失败: {str(e)}'
            }
    
    async def _execute_locally(
        self,
        code: str,
        test_inputs: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        本地执行Python代码（不安全，仅用于Docker不可用时的备选方案）
        警告：不要在生产环境使用！
        """
        print("⚠️ 警告：使用不安全的本地执行")
        
        try:
            # 创建一个受限的执行环境
            restricted_globals = {
                '__builtins__': {
                    'print': print,
                    'range': range,
                    'len': len,
                    'int': int,
                    'float': float,
                    'str': str,
                    'list': list,
                    'dict': dict,
                    'tuple': tuple,
                    'set': set,
                    'sum': sum,
                    'max': max,
                    'min': min,
                    'abs': abs,
                    'round': round,
                    'sorted': sorted,
                    'enumerate': enumerate,
                    'zip': zip,
                }
            }
            
            # 捕获输出
            import io
            import sys
            old_stdout = sys.stdout
            sys.stdout = io.StringIO()
            
            try:
                # 执行代码
                exec(code, restricted_globals)
                output = sys.stdout.getvalue()
                
                return {
                    'success': True,
                    'output': output,
                    'error': None,
                    'warning': '使用本地执行（不安全）'
                }
            finally:
                sys.stdout = old_stdout
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'warning': '本地执行失败'
            }
    
    async def validate_with_test_cases(
        self,
        code: str,
        language: str,
        test_cases: list
    ) -> Dict[str, Any]:
        """
        使用测试用例验证代码
        
        Args:
            code: 要执行的代码
            language: 编程语言
            test_cases: 测试用例列表 [{'input': ..., 'expected': ...}, ...]
            
        Returns:
            验证结果
        """
        results = []
        all_passed = True
        
        for i, test_case in enumerate(test_cases):
            test_input = test_case.get('input')
            expected = str(test_case.get('expected', '')).strip()
            
            # 执行代码
            result = await self.execute_code(
                code,
                language,
                test_inputs=[test_input] if test_input else None
            )
            
            if result['success']:
                actual = result['output'].strip()
                passed = actual == expected
                all_passed = all_passed and passed
                
                results.append({
                    'test_case': i + 1,
                    'passed': passed,
                    'input': test_input,
                    'expected': expected,
                    'actual': actual
                })
            else:
                all_passed = False
                results.append({
                    'test_case': i + 1,
                    'passed': False,
                    'input': test_input,
                    'expected': expected,
                    'error': result.get('error')
                })
        
        passed_count = sum(1 for r in results if r.get('passed'))
        
        return {
            'success': True,
            'all_passed': all_passed,
            'passed_count': passed_count,
            'total_count': len(test_cases),
            'results': results
        }


# 全局代码执行服务实例
code_execution_service = CodeExecutionService()

