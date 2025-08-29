import { RegisterForm } from '@/components/auth/register-form';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '注册账号',
  description: '创建新账号以开始学习',
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <RegisterForm />
    </div>
  );
}
