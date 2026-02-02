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
  // 降级方案：当 VOD 播放失败时的备用 URL
  fallbackUrl?: string;
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
      fallbackUrl: fallbackUrlProp,
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
    const initializedFileIdRef = useRef<string | undefined>(undefined); // 记录已初始化的fileId
    const errorRetryCountRef = useRef(0); // 错误重试计数器
    const maxRetries = 2; // 最大重试次数
    const hasFallenBackRef = useRef(false); // 是否已经降级到普通URL
    const [psign, setPsign] = useState<string | undefined>(psignProp);
    const [isLoadingPsign, setIsLoadingPsign] = useState(false);
    const [fallbackUrl, setFallbackUrl] = useState<string | undefined>(undefined); // 降级URL状态

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
      
      if (!containerRef.current) {
        console.warn('⚠️ [initPlayer] containerRef.current 不存在，跳过');
        return;
      }

      // ⚠️ 重要：先检查fileId是否变化，必须在检查isInitializedRef之前
      // 如果fileId变化，需要先重置状态并销毁旧播放器
      const fileIdChanged = fileId && 
                           initializedFileIdRef.current !== undefined && 
                           initializedFileIdRef.current !== fileId;
      
      if (fileIdChanged) {
        console.log('🔄 [initPlayer] FileId变化，重置初始化状态');
        console.log(`🔄 [initPlayer] 旧FileId: ${initializedFileIdRef.current}, 新FileId: ${fileId}`);
        
        // 销毁旧播放器
        try {
          if (timeUpdateIntervalRef.current) {
            clearInterval(timeUpdateIntervalRef.current);
            timeUpdateIntervalRef.current = null;
          }
          if (playerRef.current) {
            if (typeof (playerRef.current as any).destroy === 'function') {
              (playerRef.current as any).destroy();
            } else if (typeof (playerRef.current as any).dispose === 'function') {
              (playerRef.current as any).dispose();
            }
            // 清理video元素
            const videoEl = containerRef.current?.querySelector('video');
            if (videoEl) {
              videoEl.pause();
              videoEl.src = '';
              videoEl.load();
              videoEl.remove();
            }
          }
          playerRef.current = null;
        } catch (error) {
          console.error('❌ [initPlayer] 销毁旧播放器失败:', error);
        }
        
        // 重置状态
        isInitializedRef.current = false;
        initializedFileIdRef.current = undefined;
        errorRetryCountRef.current = 0;
      }
      
      // 检查是否已经初始化（在fileId变化检测之后）
      // 如果fileId相同且已初始化，跳过（避免重复初始化）
      if (isInitializedRef.current && !fileIdChanged) {
        if (fileId && initializedFileIdRef.current === fileId) {
          console.warn('⚠️ [initPlayer] 播放器已初始化（相同fileId），跳过');
          return;
        }
        // 如果fileId不同但isInitializedRef还是true，说明状态不一致，强制重置
        console.warn('⚠️ [initPlayer] 检测到状态不一致，强制重置');
        isInitializedRef.current = false;
        initializedFileIdRef.current = undefined;
      }

      // 如果已降级，使用降级URL；否则使用普通URL
      const effectiveUrl = hasFallenBackRef.current 
        ? (fallbackUrl || fallbackUrlProp || url)
        : url;
      
      // 如果使用 VOD 模式但 psign 还未加载，等待（除非已降级）
      if (fileId && !psign && !effectiveUrl && !hasFallenBackRef.current) {
        if (isLoadingPsign) {
          console.log('⏳ [initPlayer] VOD 模式，psign 正在加载中，等待...');
        } else {
          console.warn('⚠️ [initPlayer] VOD 模式但 psign 未加载且未在加载中，跳过');
        }
        return;
      }
      
      // 如果已降级，确保有降级URL
      if (hasFallenBackRef.current && !effectiveUrl) {
        console.warn('⚠️ [initPlayer] 已降级但无降级URL，无法播放');
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

        // 如果是普通 URL 模式（包括降级模式）
        if (hasFallenBackRef.current && effectiveUrl) {
          console.log('🔧 [initPlayer] 使用降级 URL 模式');
          options.fileID = '';
          options.sources = [
            {
              src: effectiveUrl,
              type: effectiveUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4',
            },
          ];
        } else if (!fileId && effectiveUrl) {
          console.log('🔧 [initPlayer] 使用普通 URL 模式');
          options.fileID = '';
          options.sources = [
            {
              src: effectiveUrl,
              type: effectiveUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4',
            },
          ];
        } else if (fileId && !hasFallenBackRef.current) {
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

        // 保存当前配置到局部变量，供错误回调使用（避免闭包问题）
        const currentFileId = fileId;
        const currentAppId = appId;
        const currentPsign = psign;
        const currentUrl = effectiveUrl;
        const currentVideoElement = videoElement;
        const currentFallbackUrl = fallbackUrlProp || fallbackUrl;

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

        player.on('error', async (error: any) => {
          console.error('❌ [TCPlayer] 播放错误:', error);
          console.error('❌ [TCPlayer] 错误类型:', typeof error);
          
          // 安全地序列化错误对象，避免循环引用
          let errorCode: number | undefined;
          let errorMessage: string | undefined;
          try {
            // 尝试提取错误的关键信息
            const errorInfo: any = {};
            if (error && typeof error === 'object') {
              // 提取常见属性
              if ('code' in error) {
                errorInfo.code = error.code;
                errorCode = error.code;
              }
              if ('message' in error) {
                errorInfo.message = error.message;
                errorMessage = error.message;
              }
              if ('detail' in error) errorInfo.detail = error.detail;
              if ('name' in error) errorInfo.name = error.name;
              // 尝试获取TCPlayer特定的错误信息
              if (error.errorCode !== undefined) {
                errorInfo.errorCode = error.errorCode;
                errorCode = error.errorCode;
              }
              if (error.errorMsg !== undefined) {
                errorInfo.errorMsg = error.errorMsg;
                errorMessage = error.errorMsg;
              }
            } else {
              errorInfo.value = String(error);
            }
            console.error('❌ [TCPlayer] 错误详情:', errorInfo);
          } catch (e) {
            console.error('❌ [TCPlayer] 无法序列化错误对象:', e);
            console.error('❌ [TCPlayer] 错误对象:', error);
          }
          
          // 使用保存的局部变量，避免闭包问题
          try {
            console.error('❌ [TCPlayer] 当前配置:', {
              fileID: currentFileId,
              appID: currentAppId,
              hasPsign: !!currentPsign,
              psignLength: currentPsign?.length || 0,
              url: currentUrl,
              retryCount: errorRetryCountRef.current,
              videoElement: currentVideoElement ? {
                src: currentVideoElement.src,
                currentSrc: currentVideoElement.currentSrc,
                readyState: currentVideoElement.readyState,
                error: currentVideoElement.error ? {
                  code: currentVideoElement.error.code,
                  message: currentVideoElement.error.message,
                } : null,
              } : null,
            });
          } catch (configError) {
            console.error('❌ [TCPlayer] 无法打印配置:', configError);
            // 降级方案：只打印基本信息
            console.error('❌ [TCPlayer] 当前配置（简化）:', {
              fileID: currentFileId || 'undefined',
              hasPsign: !!currentPsign,
              retryCount: errorRetryCountRef.current,
            });
          }
          
          // 尝试从 video 元素获取更详细的错误信息
          if (currentVideoElement && currentVideoElement.error) {
            const videoError = currentVideoElement.error;
            console.error('❌ [TCPlayer] Video 元素错误:', {
              code: videoError.code,
              message: videoError.message,
              MEDIA_ERR_ABORTED: videoError.code === videoError.MEDIA_ERR_ABORTED,
              MEDIA_ERR_NETWORK: videoError.code === videoError.MEDIA_ERR_NETWORK,
              MEDIA_ERR_DECODE: videoError.code === videoError.MEDIA_ERR_DECODE,
              MEDIA_ERR_SRC_NOT_SUPPORTED: videoError.code === videoError.MEDIA_ERR_SRC_NOT_SUPPORTED,
            });
          }
          
          // 检查是否是1009错误（通常是网络问题或psign问题）
          const isError1009 = errorCode === 1009 || errorCode === '1009' || 
                              (errorMessage && errorMessage.includes('1009')) ||
                              (errorMessage && errorMessage.includes('ERR_NAME_NOT_RESOLVED'));
          
          // 检查是否是网络错误
          const isNetworkError = currentVideoElement?.error?.code === currentVideoElement?.error?.MEDIA_ERR_NETWORK ||
                                (errorMessage && (
                                  errorMessage.includes('ERR_NAME_NOT_RESOLVED') ||
                                  errorMessage.includes('network') ||
                                  errorMessage.includes('Network')
                                ));
          
          // 检查是否是不支持的源错误（CODE:4 MEDIA_ERR_SRC_NOT_SUPPORTED）
          const isSrcNotSupported = errorCode === 4 || 
                                   errorCode === '4' ||
                                   currentVideoElement?.error?.code === currentVideoElement?.error?.MEDIA_ERR_SRC_NOT_SUPPORTED ||
                                   (errorMessage && (
                                     errorMessage.includes('MEDIA_ERR_SRC_NOT_SUPPORTED') ||
                                     errorMessage.includes('无法找到此视频兼容的源') ||
                                     errorMessage.includes('无法播放该视频')
                                   ));
          
          // 如果是不支持的源错误，且有降级URL，切换到降级方案
          if (isSrcNotSupported && !hasFallenBackRef.current && currentFallbackUrl) {
            const fallbackUrlToUse = currentFallbackUrl;
            console.log('⚠️ [TCPlayer] 检测到不支持的源错误，切换到降级方案');
            console.log('⚠️ [TCPlayer] 降级URL:', fallbackUrlToUse);
            
            // 标记已降级
            hasFallenBackRef.current = true;
            setFallbackUrl(fallbackUrlToUse);
            
            // 销毁当前播放器
            try {
              if (timeUpdateIntervalRef.current) {
                clearInterval(timeUpdateIntervalRef.current);
                timeUpdateIntervalRef.current = null;
              }
              if (playerRef.current) {
                if (typeof (playerRef.current as any).destroy === 'function') {
                  (playerRef.current as any).destroy();
                } else if (typeof (playerRef.current as any).dispose === 'function') {
                  (playerRef.current as any).dispose();
                }
                const videoEl = containerRef.current?.querySelector('video');
                if (videoEl) {
                  videoEl.pause();
                  videoEl.src = '';
                  videoEl.load();
                  videoEl.remove();
                }
              }
              playerRef.current = null;
              isInitializedRef.current = false;
              initializedFileIdRef.current = undefined;
            } catch (e) {
              console.error('❌ [TCPlayer] 销毁播放器失败:', e);
            }
            
            // 延迟一下再重新初始化，使用降级URL
            setTimeout(() => {
              console.log('🔄 [TCPlayer] 使用降级URL重新初始化播放器');
              initPlayer();
            }, 500);
            
            return; // 不继续执行，等待降级初始化
          }
          
          // 如果是1009错误或网络错误，且未超过重试次数，尝试重新获取psign并重新初始化
          if ((isError1009 || isNetworkError) && currentFileId && errorRetryCountRef.current < maxRetries) {
            errorRetryCountRef.current += 1;
            console.log(`🔄 [TCPlayer] 检测到错误1009或网络错误，尝试重新获取psign (第${errorRetryCountRef.current}次重试)`);
            
            // 销毁当前播放器
            try {
              if (timeUpdateIntervalRef.current) {
                clearInterval(timeUpdateIntervalRef.current);
                timeUpdateIntervalRef.current = null;
              }
              if (playerRef.current) {
                if (typeof (playerRef.current as any).destroy === 'function') {
                  (playerRef.current as any).destroy();
                } else if (typeof (playerRef.current as any).dispose === 'function') {
                  (playerRef.current as any).dispose();
                }
                const videoEl = containerRef.current?.querySelector('video');
                if (videoEl) {
                  videoEl.pause();
                  videoEl.src = '';
                  videoEl.load();
                  videoEl.remove();
                }
              }
              playerRef.current = null;
              isInitializedRef.current = false;
              initializedFileIdRef.current = undefined;
            } catch (e) {
              console.error('❌ [TCPlayer] 销毁播放器失败:', e);
            }
            
            // 清除旧的psign，重新获取
            setPsign(undefined);
            setIsLoadingPsign(true);
            
            // 延迟一下再重新获取psign，避免立即重试
            setTimeout(async () => {
              try {
                console.log('🔄 [TCPlayer] 重新获取psign...');
                const response = await vodAPI.getPsign(currentFileId, currentAppId);
                console.log('✅ [TCPlayer] 重新获取psign成功');
                setPsign(response.psign);
                setIsLoadingPsign(false);
                // psign更新后会自动触发重新初始化
              } catch (retryError) {
                console.error('❌ [TCPlayer] 重新获取psign失败:', retryError);
                setIsLoadingPsign(false);
                errorRetryCountRef.current = maxRetries; // 标记为已重试失败
                if (onError) {
                  const safeError = {
                    code: errorCode || 1009,
                    message: isNetworkError 
                      ? '网络连接失败，请检查网络连接后重试'
                      : '播放失败，请刷新页面重试',
                    detail: '重试获取psign失败',
                    retried: true,
                  };
                  onError(safeError);
                }
              }
            }, 1000); // 延迟1秒重试
            
            return; // 不继续执行，等待重试
          }
          
          // 如果超过重试次数或不是可重试的错误，直接报告错误
          if (onError) {
            // 传递一个简化的错误对象，避免循环引用
            const safeError = error && typeof error === 'object' 
              ? { 
                  code: errorCode || error.code, 
                  message: isNetworkError 
                    ? '网络连接失败，请检查网络连接'
                    : (errorMessage || error.message || '播放失败'),
                  detail: error.detail,
                  retried: errorRetryCountRef.current > 0,
                }
              : error;
            onError(safeError);
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
        // 如果使用降级URL，记录为undefined（表示不是VOD模式）
        initializedFileIdRef.current = hasFallenBackRef.current ? undefined : fileId;
        errorRetryCountRef.current = 0; // 重置错误重试计数器
        
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
    }, [containerId, fileId, appId, psign, url, fallbackUrl, fallbackUrlProp, autoplay, controls, playbackRate, licenseUrl, licenseKey, onReady, onPlay, onPause, onEnded, onError, onTimeUpdate]);

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
        initializedFileId: initializedFileIdRef.current,
      });
      
      // 检查fileId是否变化
      const fileIdChanged = fileId && initializedFileIdRef.current !== undefined && initializedFileIdRef.current !== fileId;
      
      // 如果fileId变化，即使已初始化也需要重新初始化
      const shouldInit = fileId && psign && window.TCPlayer && (!isInitializedRef.current || fileIdChanged);
      
      if (shouldInit) {
        if (fileIdChanged) {
          console.log('🔄 [TCPlayer] FileId变化且psign已加载，触发重新初始化');
        } else {
          console.log('🔄 [TCPlayer] psign 已加载，触发初始化');
        }
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
        if (isInitializedRef.current && !fileIdChanged) {
          console.log('✅ [TCPlayer] 播放器已初始化（相同fileId）');
        }
      }
    }, [fileId, psign, initPlayer]);

    // 保存上次的参数，只在真正变化时重新初始化
    const lastParamsRef = useRef<{ fileId?: string; psign?: string; url?: string }>({});
    
    // 当fileId变化时，清除旧的psign并重置初始化状态（除非是prop传入的）
    useEffect(() => {
      const lastFileId = lastParamsRef.current?.fileId;
      if (fileId && lastFileId && lastFileId !== fileId) {
        console.log('🔄 [TCPlayer] FileId变化，清除旧的psign和初始化状态');
        console.log(`🔄 [TCPlayer] 旧FileId: ${lastFileId}, 新FileId: ${fileId}`);
        
        // 如果播放器已初始化，先销毁
        if (isInitializedRef.current && playerRef.current) {
          try {
            if (timeUpdateIntervalRef.current) {
              clearInterval(timeUpdateIntervalRef.current);
              timeUpdateIntervalRef.current = null;
            }
            if (typeof (playerRef.current as any).destroy === 'function') {
              (playerRef.current as any).destroy();
            } else if (typeof (playerRef.current as any).dispose === 'function') {
              (playerRef.current as any).dispose();
            }
            const videoEl = containerRef.current?.querySelector('video');
            if (videoEl) {
              videoEl.pause();
              videoEl.src = '';
              videoEl.load();
              videoEl.remove();
            }
          } catch (error) {
            console.error('❌ [TCPlayer] 销毁播放器失败:', error);
          }
          playerRef.current = null;
        }
        
        // 清除旧的psign（如果不是prop传入的）
        if (psign && !psignProp) {
          setPsign(undefined);
          setIsLoadingPsign(false);
        }
        
        // 重置初始化状态和降级状态
        isInitializedRef.current = false;
        initializedFileIdRef.current = undefined;
        errorRetryCountRef.current = 0;
        hasFallenBackRef.current = false; // 重置降级状态，允许新fileId尝试VOD
        setFallbackUrl(undefined); // 清除降级URL
      }
    }, [fileId, psign, psignProp]);
    
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
      
      console.log('🔄 [TCPlayer] 检测到参数变化');
      console.log('🔄 [TCPlayer] 旧参数:', lastParams);
      console.log('🔄 [TCPlayer] 新参数:', currentParams);
      
      // 更新最后的参数
      lastParamsRef.current = currentParams;
      
      // 如果fileId变化，需要销毁并重新初始化（即使psign还没加载）
      if (lastParams.fileId !== currentParams.fileId && currentParams.fileId) {
        console.log('🔄 [TCPlayer] FileId变化，销毁旧播放器');
        console.log(`🔄 [TCPlayer] 旧FileId: ${lastParams.fileId}, 新FileId: ${currentParams.fileId}`);
        
        // 如果播放器已初始化，先销毁
        if (isInitializedRef.current && playerRef.current) {
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
            // 清理video元素
            const videoEl = containerRef.current?.querySelector('video');
            if (videoEl) {
              videoEl.pause();
              videoEl.src = '';
              videoEl.load();
              videoEl.remove();
            }
          } catch (error) {
            console.error('❌ [TCPlayer] 销毁旧播放器失败:', error);
          }
        }
        
        // 重置状态（无论播放器是否已初始化）
        playerRef.current = null;
        isInitializedRef.current = false;
        initializedFileIdRef.current = undefined;
        errorRetryCountRef.current = 0;
        
        // 清除旧的psign（如果不是prop传入的），触发重新获取
        if (psign && !psignProp) {
          console.log('🔄 [TCPlayer] FileId变化，清除旧的psign');
          setPsign(undefined);
          setIsLoadingPsign(false);
        }
      }
      
      // 如果psign或url变化，且播放器已初始化，也需要重新初始化
      if ((lastParams.psign !== currentParams.psign || lastParams.url !== currentParams.url) 
          && isInitializedRef.current && playerRef.current) {
        console.log('🔄 [TCPlayer] Psign/URL变化，重新初始化播放器');
        
        // 销毁旧播放器
        try {
          if (timeUpdateIntervalRef.current) {
            clearInterval(timeUpdateIntervalRef.current);
            timeUpdateIntervalRef.current = null;
          }
          if (typeof (playerRef.current as any).destroy === 'function') {
            (playerRef.current as any).destroy();
          } else if (typeof (playerRef.current as any).dispose === 'function') {
            (playerRef.current as any).dispose();
          }
        } catch (error) {
          console.error('❌ [TCPlayer] 销毁旧播放器失败:', error);
        }
        playerRef.current = null;
        isInitializedRef.current = false;
        initializedFileIdRef.current = undefined;
      }
      
      // 如果播放器未初始化，且满足初始化条件，则初始化
      // 或者如果fileId变化了，即使已初始化也需要重新初始化
      const shouldReinit = !isInitializedRef.current || 
                          (lastParams.fileId !== currentParams.fileId && currentParams.fileId);
      
      if (shouldReinit && window.TCPlayer) {
        if ((fileId && psign) || url) {
          console.log('🔄 [TCPlayer] 满足初始化条件，开始初始化');
          console.log(`🔄 [TCPlayer] 原因: ${!isInitializedRef.current ? '未初始化' : 'fileId变化'}`);
          setTimeout(() => {
            initPlayer();
          }, 100);
        } else if (fileId && !psign && !isLoadingPsign) {
          // fileId变化但psign还未加载，触发psign加载
          console.log('🔄 [TCPlayer] FileId变化，但psign未加载，等待psign加载');
        }
      }
    }, [fileId, psign, url, initPlayer, isLoadingPsign]);

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
        initializedFileIdRef.current = undefined;
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
            initializedFileIdRef.current = undefined;
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
