import { useEffect, useState } from 'react';

/**
 * 移动端布局检测Hook
 * 以1024px为分界点区分移动端和桌面端
 */
export function useMobileLayout() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [screenWidth, setScreenWidth] = useState(0);

  useEffect(() => {
    const checkLayout = () => {
      const width = window.innerWidth;
      setScreenWidth(width);
      setIsMobile(width < 1024);
      setIsTablet(width >= 768 && width < 1024);
    };

    // 初始检测
    checkLayout();

    // 监听窗口大小变化
    window.addEventListener('resize', checkLayout);
    
    return () => {
      window.removeEventListener('resize', checkLayout);
    };
  }, []);

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    screenWidth,
  };
}
