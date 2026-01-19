'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import Script from 'next/script';
import { vodAPI } from '@/lib/backend-api';

declare global {
  interface Window {
    TCPlayer: any;
  }
}

export interface TCPlayerInstance {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setPlaybackRate: (rate: number) => void;
  getPlaybackRate: () => number;
  getVideoElement: () => HTMLVideoElement | null;
  destroy: () => void;
}

export interface TCPlayerProps {
  containerId: string;
  // VOD 模式
  fileId?: string;
  appId?: number;
  psign?: string;
  // 普通 URL 模式
  url?: string;
  // 回调函数
  onTimeUpdate?: (currentTime: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: any) => void;
  onReady?: () => void;
  // 播放器配置
  autoplay?: boolean;
  controls?: boolean;
  playbackRate?: number;
  // License 配置
  licenseUrl?: string;
  licenseKey?: string;
}

const TCPlayerComponent = forwardRef<TCPlayerInstance, TCPlayerProps>(
  (
    {
      containerId,
      fileId,
      appId,
      psign: psignProp,
      url,
      onTimeUpdate,
      onPlay,
      onPause,
      onEnded,
      onError,
      onReady,
      autoplay = false,
      controls = true,
      playbackRate = 1.0,
      licenseUrl,
      licenseKey,
    },
    ref
  ) => {
    const playerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isInitializedRef = useRef(false);
    const [psign, setPsign] = useState<string | undefined>(psignProp);
    const [isLoadingPsign, setIsLoadingPsign] = useState(false);

    // 如果使用 VOD 模式但没有提供 psign，动态获取
    useEffect(() => {
      if (fileId && !psign && !isLoadingPsign && !psignProp) {
        console.log('🔄 [TCPlayer] 开始获取 VOD psign...');
        console.log('🔄 [TCPlayer] FileId:', fileId);
        console.log('🔄 [TCPlayer] AppId:', appId);
        setIsLoadingPsign(true);
        vodAPI
          .getPsign(fileId, appId)
          .then((response) => {
            console.log('✅ [TCPlayer] 获取 VOD psign 成功');
            console.log('✅ [TCPlayer] Psign:', response.psign ? `${response.psign.substring(0, 50)}...` : 'null');
            setPsign(response.psign);
            setIsLoadingPsign(false);
          })
          .catch((error) => {
            console.error('❌ [TCPlayer] 获取 VOD psign 失败:', error);
            setIsLoadingPsign(false);
            if (onError) {
              onError(error);
            }
          });
      } else if (fileId && psignProp) {
        console.log('✅ [TCPlayer] 使用传入的 psign');
        setPsign(psignProp);
      } else if (fileId && psign) {
        console.log('✅ [TCPlayer] 使用已加载的 psign');
      }
    }, [fileId, appId, psign, psignProp, isLoadingPsign, onError]);

    // 初始化播放器函数
    const initPlayer = useCallback(() => {
      console.log('🔧 [initPlayer] 开始初始化播放器');
      console.log('🔧 [initPlayer] window.TCPlayer:', !!window.TCPlayer);
      console.log('🔧 [initPlayer] isInitializedRef.current:', isInitializedRef.current);
      console.log('🔧 [initPlayer] containerRef.current:', !!containerRef.current);
      console.log('🔧 [initPlayer] fileId:', fileId);
      console.log('🔧 [initPlayer] psign:', psign ? `${psign.substring(0, 50)}...` : 'null');
      console.log('🔧 [initPlayer] url:', url ? `${url.substring(0, 100)}...` : 'null');
      console.log('🔧 [initPlayer] appId:', appId);
      console.log('🔧 [initPlayer] isLoadingPsign:', isLoadingPsign);
      
      if (!window.TCPlayer) {
        console.warn('⚠️ [initPlayer] window.TCPlayer 不存在，跳过');
        return;
      }
      
      if (isInitializedRef.current) {
        console.warn('⚠️ [initPlayer] 播放器已初始化，跳过');
        return;
      }
      
      if (!containerRef.current) {
        console.warn('⚠️ [initPlayer] containerRef.current 不存在，跳过');
        return;
      }

      // 如果使用 VOD 模式但 psign 还未加载，等待
      if (fileId && !psign && !url) {
        if (isLoadingPsign) {
          console.log('⏳ [initPlayer] VOD 模式，psign 正在加载中，等待...');
        } else {
          console.warn('⚠️ [initPlayer] VOD 模式但 psign 未加载且未在加载中，跳过');
        }
        return;
      }

      try {
        const options: any = {
          fileID: fileId || '',
          appID: appId,
          psign: psign,
          autoplay: autoplay,
          controls: controls,
          playbackRate: playbackRate,
          // 启用自适应码率（仅VOD模式）
          ...(fileId && {
            plugins: {
              ContinuePlay: {
                auto: false,
              },
            },
          }),
        };
        
        console.log('🔧 [initPlayer] TCPlayer options:', {
          fileID: options.fileID,
          appID: options.appID,
          psign: options.psign ? `${options.psign.substring(0, 50)}...` : 'null',
          hasPlugins: !!options.plugins,
        });

        // 如果有 License，添加配置
        if (licenseUrl && licenseKey) {
          options.plugins = {
            ...options.plugins,
            License: {
              licenseUrl: licenseUrl,
              licenseKey: licenseKey,
            },
          };
        }

        // 如果是普通 URL 模式
        if (!fileId && url) {
          console.log('🔧 [initPlayer] 使用普通 URL 模式');
          options.fileID = '';
          options.sources = [
            {
              src: url,
              type: url.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4',
            },
          ];
        } else if (fileId) {
          console.log('🔧 [initPlayer] 使用 VOD 模式');
        }

        // TCPlayer 需要一个 <video> 元素，而不是 div
        // 检查容器中是否已有 video 元素
        let videoElement = containerRef.current.querySelector('video') as HTMLVideoElement;
        
        // 如果没有 video 元素，创建一个
        if (!videoElement) {
          videoElement = document.createElement('video');
          videoElement.id = containerId;
          videoElement.className = 'w-full h-full';
          videoElement.setAttribute('playsinline', 'true');
          videoElement.setAttribute('webkit-playsinline', 'true');
          videoElement.setAttribute('x5-playsinline', 'true');
          videoElement.setAttribute('x5-video-player-type', 'h5-page');
          videoElement.crossOrigin = 'anonymous'; // 支持截图功能
          videoElement.style.width = '100%';
          videoElement.style.height = '100%';
          containerRef.current.appendChild(videoElement);
        } else {
          // 如果已存在，确保设置了 crossOrigin
          videoElement.crossOrigin = 'anonymous';
        }
        
        // 创建播放器实例（TCPlayer 可以接受 video 元素或 ID）
        // 根据文档，TCPlayer 的第一个参数可以是元素 ID 或元素本身
        // 但根据错误信息，它期望的是 video 元素
        console.log('🔧 [initPlayer] 创建 TCPlayer 实例');
        const player = window.TCPlayer(videoElement, options);
        console.log('✅ [initPlayer] TCPlayer 实例已创建:', player);

        // 监听事件
        player.on('loadedmetadata', () => {
          console.log('✅ TCPlayer 加载完成');
          
          // 打印实际播放的 URL
          try {
            if (fileId && psign) {
              console.log('🎬 [TCPlayer] 播放模式: VOD (腾讯云点播)');
              console.log('🎬 [TCPlayer] FileID:', fileId);
              console.log('🎬 [TCPlayer] AppID:', appId);
              console.log('🎬 [TCPlayer] Psign:', psign ? `${psign.substring(0, 50)}...` : 'null');
            } else if (url) {
              console.log('🎬 [TCPlayer] 播放模式: 普通 URL');
              console.log('🎬 [TCPlayer] URL:', url.substring(0, 150) + (url.length > 150 ? '...' : ''));
            }
            
            // 尝试从 video 元素获取实际播放的 URL
            if (videoElement) {
              console.log('🎬 [TCPlayer] video.src:', videoElement.src || '(空)');
              console.log('🎬 [TCPlayer] video.currentSrc:', videoElement.currentSrc || '(空)');
              
              // 检查 source 元素
              const sources = videoElement.querySelectorAll('source');
              if (sources.length > 0) {
                console.log(`🎬 [TCPlayer] 找到 ${sources.length} 个 source 元素:`);
                sources.forEach((source, index) => {
                  console.log(`  source[${index}].src:`, source.src || '(空)');
                  console.log(`  source[${index}].type:`, source.type || '(空)');
                });
              } else {
                console.log('🎬 [TCPlayer] 未找到 source 元素（可能是 VOD 模式）');
              }
            }
          } catch (error) {
            console.warn('⚠️ 无法获取播放 URL:', error);
          }
          
          if (onReady) {
            onReady();
          }
        });

        player.on('play', () => {
          console.log('▶️ TCPlayer 播放');
          if (onPlay) {
            onPlay();
          }
        });

        player.on('pause', () => {
          console.log('⏸️ TCPlayer 暂停');
          if (onPause) {
            onPause();
          }
        });

        player.on('ended', () => {
          console.log('⏹️ TCPlayer 结束');
          if (onEnded) {
            onEnded();
          }
        });

        player.on('error', (error: any) => {
          console.error('❌ [TCPlayer] 播放错误:', error);
          console.error('❌ [TCPlayer] 错误类型:', typeof error);
          console.error('❌ [TCPlayer] 错误详情:', JSON.stringify(error, null, 2));
          console.error('❌ [TCPlayer] 当前配置:', {
            fileID: fileId,
            appID: appId,
            hasPsign: !!psign,
            psignLength: psign?.length || 0,
            url: url,
            videoElement: videoElement ? {
              src: videoElement.src,
              currentSrc: videoElement.currentSrc,
              readyState: videoElement.readyState,
              error: videoElement.error,
            } : null,
          });
          
          // 尝试从 video 元素获取更详细的错误信息
          if (videoElement && videoElement.error) {
            const videoError = videoElement.error;
            console.error('❌ [TCPlayer] Video 元素错误:', {
              code: videoError.code,
              message: videoError.message,
              MEDIA_ERR_ABORTED: videoError.code === videoError.MEDIA_ERR_ABORTED,
              MEDIA_ERR_NETWORK: videoError.code === videoError.MEDIA_ERR_NETWORK,
              MEDIA_ERR_DECODE: videoError.code === videoError.MEDIA_ERR_DECODE,
              MEDIA_ERR_SRC_NOT_SUPPORTED: videoError.code === videoError.MEDIA_ERR_SRC_NOT_SUPPORTED,
            });
          }
          
          if (onError) {
            onError(error);
          }
        });

          // 时间更新监听（TCPlayer 可能不直接支持 onTimeUpdate，使用定时器）
          if (onTimeUpdate) {
            timeUpdateIntervalRef.current = setInterval(() => {
              try {
                // 优先从 video 元素获取时间（更可靠）
                if (videoElement && videoElement.readyState > 0) {
                  const currentTime = videoElement.currentTime;
                  if (typeof currentTime === 'number' && !isNaN(currentTime)) {
                    onTimeUpdate(currentTime);
                  }
                } else if (typeof player.currentTime === 'function') {
                  // 降级方案：从播放器获取
                  const currentTime = player.currentTime();
                  if (typeof currentTime === 'number' && !isNaN(currentTime)) {
                    onTimeUpdate(currentTime);
                  }
                }
              } catch (error) {
                // 忽略错误，可能播放器还未完全初始化
              }
            }, 100); // 每 100ms 更新一次
          }

        playerRef.current = player;
        isInitializedRef.current = true;
        
        // 保存 video 元素引用，方便后续使用（截图、跳转等）
        if (videoElement) {
          (playerRef.current as any)._videoElement = videoElement;
        }
      } catch (error) {
        console.error('❌ TCPlayer 初始化失败:', error);
        if (onError) {
          onError(error);
        }
      }
    }, [containerId, fileId, appId, psign, url, autoplay, controls, playbackRate, licenseUrl, licenseKey, onReady, onPlay, onPause, onEnded, onError, onTimeUpdate]);

    // 监听 SDK 加载完成事件并初始化播放器
    useEffect(() => {
      const handleSDKLoaded = () => {
        // SDK 加载完成后，延迟初始化，确保 DOM 已准备好
        setTimeout(() => {
          initPlayer();
        }, 100);
      };

      window.addEventListener('tcplayer-loaded', handleSDKLoaded);

      // 如果 SDK 已经加载，直接尝试初始化
      if (window.TCPlayer) {
        handleSDKLoaded();
      }

      return () => {
        window.removeEventListener('tcplayer-loaded', handleSDKLoaded);
      };
    }, [initPlayer]);
    
    // 当 psign 加载完成后，触发初始化
    useEffect(() => {
      console.log('🔍 [TCPlayer] 检查初始化条件:', {
        fileId: fileId,
        hasPsign: !!psign,
        hasTCPlayer: !!window.TCPlayer,
        isInitialized: isInitializedRef.current,
      });
      
      if (fileId && psign && window.TCPlayer && !isInitializedRef.current) {
        console.log('🔄 [TCPlayer] psign 已加载，触发初始化');
        // 延迟一下确保状态更新完成
        setTimeout(() => {
          initPlayer();
        }, 100);
      } else {
        if (!fileId) {
          console.log('⏳ [TCPlayer] 等待 fileId');
        }
        if (!psign && fileId) {
          console.log('⏳ [TCPlayer] 等待 psign 加载');
        }
        if (!window.TCPlayer) {
          console.log('⏳ [TCPlayer] 等待 TCPlayer SDK 加载');
        }
        if (isInitializedRef.current) {
          console.log('✅ [TCPlayer] 播放器已初始化');
        }
      }
    }, [fileId, psign, initPlayer]);

    // 保存上次的参数，只在真正变化时重新初始化
    const lastParamsRef = useRef<{ fileId?: string; psign?: string; url?: string }>({});
    
    // 当关键参数变化时，重新初始化
    useEffect(() => {
      // 检查参数是否真的变化了
      const currentParams = { fileId, psign, url };
      const lastParams = lastParamsRef.current;
      
      const hasChanged = 
        lastParams.fileId !== currentParams.fileId ||
        lastParams.psign !== currentParams.psign ||
        lastParams.url !== currentParams.url;
      
      // 如果参数没变化，不做任何事
      if (!hasChanged) {
        return;
      }
      
      // 更新最后的参数
      lastParamsRef.current = currentParams;
      
      // 只有在播放器已经初始化时才需要重新初始化
      if (window.TCPlayer && isInitializedRef.current && playerRef.current) {
        console.log('🔄 检测到参数变化，重新初始化播放器');
        console.log('旧参数:', lastParams);
        console.log('新参数:', currentParams);
        
        // 销毁旧播放器
        try {
          if (timeUpdateIntervalRef.current) {
            clearInterval(timeUpdateIntervalRef.current);
            timeUpdateIntervalRef.current = null;
          }
          // TCPlayer 可能使用 dispose 而不是 destroy
          if (typeof (playerRef.current as any).destroy === 'function') {
            (playerRef.current as any).destroy();
          } else if (typeof (playerRef.current as any).dispose === 'function') {
            (playerRef.current as any).dispose();
          }
        } catch (error) {
          console.error('❌ 销毁旧播放器失败:', error);
        }
        playerRef.current = null;
        isInitializedRef.current = false;
        
        // 重新初始化
        setTimeout(() => {
          if ((fileId && psign) || url) {
            initPlayer();
          }
        }, 100);
      }
    }, [fileId, psign, url]);

    // 清理函数
    useEffect(() => {
      return () => {
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current);
          timeUpdateIntervalRef.current = null;
        }
        if (playerRef.current) {
          try {
            // TCPlayer 可能使用 dispose 而不是 destroy
            if (typeof (playerRef.current as any).destroy === 'function') {
              (playerRef.current as any).destroy();
            } else if (typeof (playerRef.current as any).dispose === 'function') {
              (playerRef.current as any).dispose();
            } else {
              // 降级方案：手动清理
              const videoEl = containerRef.current?.querySelector('video');
              if (videoEl) {
                videoEl.pause();
                videoEl.src = '';
                videoEl.load();
              }
            }
          } catch (error) {
            console.error('❌ TCPlayer 销毁失败:', error);
          }
          playerRef.current = null;
        }
        isInitializedRef.current = false;
      };
    }, []);

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      play: () => {
        if (playerRef.current) {
          try {
            playerRef.current.play();
          } catch (error) {
            console.error('❌ TCPlayer play 失败:', error);
          }
        }
      },
      pause: () => {
        if (playerRef.current) {
          try {
            playerRef.current.pause();
          } catch (error) {
            console.error('❌ TCPlayer pause 失败:', error);
          }
        }
      },
      seek: (time: number) => {
        // 优先尝试通过 video 元素直接设置（更可靠）
        const videoEl = containerRef.current?.querySelector('video') as HTMLVideoElement;
        if (videoEl) {
          try {
            videoEl.currentTime = time;
            return;
          } catch (error) {
            console.warn('⚠️ 直接设置 video.currentTime 失败，尝试使用播放器 API:', error);
          }
        }
        
        // 降级方案：使用播放器 API
        if (playerRef.current) {
          try {
            if (typeof playerRef.current.seek === 'function') {
              playerRef.current.seek(time);
            } else if (typeof playerRef.current.currentTime === 'function') {
              // 如果 seek 不存在，尝试直接设置 currentTime
              playerRef.current.currentTime(time);
            }
          } catch (error) {
            console.error('❌ TCPlayer seek 失败:', error);
          }
        }
      },
      getCurrentTime: () => {
        // 优先从 video 元素获取（更可靠）
        const videoEl = containerRef.current?.querySelector('video') as HTMLVideoElement;
        if (videoEl && videoEl.readyState > 0) {
          return videoEl.currentTime || 0;
        }
        
        // 降级方案：从播放器获取
        if (playerRef.current) {
          try {
            if (typeof playerRef.current.currentTime === 'function') {
              return playerRef.current.currentTime() || 0;
            }
          } catch (error) {
            console.error('❌ TCPlayer getCurrentTime 失败:', error);
          }
        }
        return 0;
      },
      getDuration: () => {
        if (playerRef.current) {
          try {
            return playerRef.current.duration() || 0;
          } catch (error) {
            console.error('❌ TCPlayer getDuration 失败:', error);
            return 0;
          }
        }
        return 0;
      },
      setPlaybackRate: (rate: number) => {
        if (playerRef.current) {
          try {
            playerRef.current.playbackRate(rate);
          } catch (error) {
            console.error('❌ TCPlayer setPlaybackRate 失败:', error);
          }
        }
      },
      getPlaybackRate: () => {
        if (playerRef.current) {
          try {
            return playerRef.current.playbackRate() || 1.0;
          } catch (error) {
            console.error('❌ TCPlayer getPlaybackRate 失败:', error);
            return 1.0;
          }
        }
        return 1.0;
      },
      getVideoElement: () => {
        if (containerRef.current) {
          try {
            // 优先从播放器实例获取保存的 video 元素引用
            if (playerRef.current && (playerRef.current as any)._videoElement) {
              const videoElement = (playerRef.current as any)._videoElement as HTMLVideoElement;
              // 确保设置了 crossOrigin（支持截图）
              if (videoElement && !videoElement.crossOrigin) {
                videoElement.crossOrigin = 'anonymous';
              }
              return videoElement;
            }
            
            // 降级方案：从容器中查找
            const videoElement = containerRef.current.querySelector('video') as HTMLVideoElement;
            if (videoElement) {
              // 确保设置了 crossOrigin（支持截图）
              if (!videoElement.crossOrigin) {
                videoElement.crossOrigin = 'anonymous';
              }
              return videoElement;
            }
            return null;
          } catch (error) {
            console.error('❌ TCPlayer getVideoElement 失败:', error);
            return null;
          }
        }
        return null;
      },
      destroy: () => {
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current);
          timeUpdateIntervalRef.current = null;
        }
        if (playerRef.current) {
          try {
            // TCPlayer 可能使用 dispose 而不是 destroy
            if (typeof (playerRef.current as any).destroy === 'function') {
              (playerRef.current as any).destroy();
            } else if (typeof (playerRef.current as any).dispose === 'function') {
              (playerRef.current as any).dispose();
            } else {
              // 降级方案：手动清理
              const videoEl = containerRef.current?.querySelector('video');
              if (videoEl) {
                videoEl.pause();
                videoEl.src = '';
                videoEl.load();
              }
            }
            playerRef.current = null;
            isInitializedRef.current = false;
          } catch (error) {
            console.error('❌ TCPlayer destroy 失败:', error);
          }
        }
      },
    }));

    // 加载 CSS 和 SDK
    useEffect(() => {
      let isMounted = true;
      
      const loadResources = async () => {
        try {
          // 1. 加载 CSS
          const existingLink = document.querySelector('link[href*="tcplayer"]');
          if (!existingLink) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://imgcache.qq.com/open/qcloud/video/tcplayer/tcplayer.min.css';
            link.id = 'tcplayer-css';
            document.head.appendChild(link);
            // 等待 CSS 加载
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // 2. 检查是否已经加载了 SDK
          if (window.TCPlayer) {
            if (isMounted) {
              const event = new Event('tcplayer-loaded');
              window.dispatchEvent(event);
            }
            return;
          }

          // 3. 加载 SDK
          const existingScript = document.querySelector('script[src*="tcplayer"]');
          if (existingScript) {
            // 如果脚本已存在但还未加载完成，等待
            const checkInterval = setInterval(() => {
              if (window.TCPlayer) {
                clearInterval(checkInterval);
                if (isMounted) {
                  const event = new Event('tcplayer-loaded');
                  window.dispatchEvent(event);
                }
              }
            }, 100);
            setTimeout(() => clearInterval(checkInterval), 10000); // 10秒超时
            return;
          }

          // 4. 创建并加载脚本
          const script = document.createElement('script');
          script.async = true;
          script.id = 'tcplayer-js';
          script.src = 'https://imgcache.qq.com/open/qcloud/video/tcplayer/tcplayer.v4.min.js';
          
          script.onload = () => {
            if (isMounted) {
              console.log('✅ TCPlayer SDK 加载完成');
              const event = new Event('tcplayer-loaded');
              window.dispatchEvent(event);
            }
          };
          
          script.onerror = () => {
            console.error('❌ TCPlayer SDK 加载失败，尝试备用 CDN...');
            // 尝试备用 CDN
            const fallbackScript = document.createElement('script');
            fallbackScript.async = true;
            fallbackScript.id = 'tcplayer-js-fallback';
            fallbackScript.src = 'https://web.sdk.qcloud.com/player/tcplayerlite/release/tcplayer.v4.4.0.min.js';
            
            fallbackScript.onload = () => {
              if (isMounted) {
                console.log('✅ TCPlayer SDK 从备用 CDN 加载完成');
                const event = new Event('tcplayer-loaded');
                window.dispatchEvent(event);
              }
            };
            
            fallbackScript.onerror = () => {
              console.error('❌ 备用 CDN 也加载失败');
              if (isMounted && onError) {
                onError(new Error('TCPlayer SDK 加载失败，请检查网络连接或使用其他播放器'));
              }
            };
            
            document.head.appendChild(fallbackScript);
          };
          
          document.head.appendChild(script);
        } catch (error) {
          console.error('❌ 加载 TCPlayer 资源失败:', error);
          if (isMounted && onError) {
            onError(error);
          }
        }
      };

      loadResources();

      return () => {
        isMounted = false;
      };
    }, [onError]);

    return (
      <>
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ minHeight: '400px' }}
        >
          {/* TCPlayer 会在初始化时自动创建 video 元素 */}
        </div>
      </>
    );
  }
);

TCPlayerComponent.displayName = 'TCPlayer';

export default TCPlayerComponent;
