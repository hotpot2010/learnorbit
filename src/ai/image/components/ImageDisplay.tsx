import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertCircle, Download, ImageIcon, Share } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { imageHelpers } from '../lib/image-helpers';
import type { ProviderTiming } from '../lib/image-types';
import { Stopwatch } from './Stopwatch';

interface ImageDisplayProps {
  provider: string;
  image: string | null | undefined;
  timing?: ProviderTiming;
  failed?: boolean;
  fallbackIcon?: React.ReactNode;
  enabled?: boolean;
  modelId: string;
}

export function ImageDisplay({
  provider,
  image,
  timing,
  failed,
  fallbackIcon,
  modelId,
}: ImageDisplayProps) {
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (isZoomed) {
      window.history.pushState({ zoomed: true }, '');
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZoomed) {
        setIsZoomed(false);
      }
    };

    const handlePopState = () => {
      if (isZoomed) {
        setIsZoomed(false);
      }
    };

    if (isZoomed) {
      document.addEventListener('keydown', handleEscape);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isZoomed]);

  const handleImageClick = (e: React.MouseEvent) => {
    if (image) {
      e.stopPropagation();
      setIsZoomed(true);
    }
  };

  const handleActionClick = (
    e: React.MouseEvent,
    imageData: string,
    provider: string
  ) => {
    e.stopPropagation();
    imageHelpers.shareOrDownload(imageData, provider).catch((error) => {
      console.error('Failed to share/download image:', error);
    });
  };

  return (
    <>
      <div
        className={cn(
          'relative w-full aspect-square group bg-zinc-50 rounded-lg',
          image && !failed && 'cursor-pointer',
          (!image || failed) && 'border-1 border-zinc-100'
        )}
        onClick={handleImageClick}
      >
        {(image || failed) && (
          <div className="absolute top-2 left-2 max-w-[75%] bg-white/95 px-2 py-1 flex items-center gap-2 rounded-lg">
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Label className="text-xs text-gray-900 truncate min-w-0 grow">
                    {imageHelpers.formatModelId(modelId)}
                  </Label>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{modelId}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        {image && !failed ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${image}`}
              alt={`Generated by ${provider}`}
              className="w-full h-full object-cover rounded-lg"
            />
            <Button
              size="icon"
              variant="secondary"
              className="absolute bottom-2 left-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              onClick={(e) => handleActionClick(e, image, provider)}
            >
              <span className="sm:hidden">
                <Share className="h-4 w-4" />
              </span>
              <span className="hidden sm:block">
                <Download className="h-4 w-4" />
              </span>
            </Button>
            {timing?.elapsed && (
              <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm rounded-md px-2 py-1 shadow">
                <span className="text-xs text-white/90 font-medium">
                  {(timing.elapsed / 1000).toFixed(1)}s
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {failed ? (
              fallbackIcon || <AlertCircle className="h-8 w-8 text-red-500" />
            ) : image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${image}`}
                  alt={`Generated by ${provider}`}
                  className="w-full h-full object-cover rounded-lg"
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute bottom-2 left-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleActionClick(e, image, provider)}
                >
                  <span className="sm:hidden">
                    <Share className="h-4 w-4" />
                  </span>
                  <span className="hidden sm:block">
                    <Download className="h-4 w-4" />
                  </span>
                </Button>
              </>
            ) : timing?.startTime ? (
              <>
                {/* <div className="text-zinc-400 mb-2">{provider}</div> */}
                <Stopwatch startTime={timing.startTime} />
              </>
            ) : (
              <ImageIcon className="h-12 w-12 text-zinc-300" />
            )}
          </div>
        )}
      </div>

      {isZoomed &&
        image &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center cursor-pointer min-h-[100dvh] w-screen"
            onClick={() => setIsZoomed(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${image}`}
              alt={`Generated by ${provider}`}
              className="max-h-[90dvh] max-w-[90vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </>
  );
}
