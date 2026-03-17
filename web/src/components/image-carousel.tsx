'use client';

import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getProxiedImageUrl } from '@/lib/image-proxy';
import { Lightbox } from './lightbox';

interface ImageCarouselProps {
  images: Array<{ url: string; order: number }>;
  title: string;
}

export function ImageCarousel({ images, title }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  const goTo = useCallback(
    (index: number) => {
      if (index < 0) setCurrentIndex(images.length - 1);
      else if (index >= images.length) setCurrentIndex(0);
      else setCurrentIndex(index);
    },
    [images.length],
  );

  const handleImageError = (index: number) => {
    setFailedImages((prev) => new Set(prev).add(index));
  };

  if (images.length === 0) return null;

  return (
    <>
      <div className="relative bg-gray-900 rounded-lg overflow-hidden">
        {/* Main image */}
        <div
          className="aspect-[16/9] flex items-center justify-center cursor-pointer"
          onClick={() => setLightboxOpen(true)}
        >
          {failedImages.has(currentIndex) ? (
            <div className="text-gray-400 text-sm">Image unavailable</div>
          ) : (
            <img
              src={getProxiedImageUrl(images[currentIndex].url)}
              alt={`${title} - ${currentIndex + 1}`}
              className="w-full h-full object-contain"
              onError={() => handleImageError(currentIndex)}
            />
          )}
        </div>

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goTo(currentIndex - 1);
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goTo(currentIndex + 1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Image counter */}
        <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 rounded text-white text-xs">
          {currentIndex + 1} / {images.length}
        </div>
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-colors ${
                i === currentIndex ? 'border-blue-500' : 'border-transparent'
              }`}
            >
              {failedImages.has(i) ? (
                <div className="w-full h-full bg-gray-200" />
              ) : (
                <img
                  src={getProxiedImageUrl(img.url)}
                  alt={`Thumbnail ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() => handleImageError(i)}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && (
        <Lightbox
          images={images}
          currentIndex={currentIndex}
          onClose={() => setLightboxOpen(false)}
          onNavigate={goTo}
          title={title}
        />
      )}
    </>
  );
}
