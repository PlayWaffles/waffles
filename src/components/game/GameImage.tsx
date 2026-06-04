"use client";

import Image, { type ImageProps } from "next/image";

type GameImagePriority = "critical" | "visible" | "deferred";

type GameImageProps = Omit<
  ImageProps,
  "loading" | "preload" | "priority" | "fetchPriority" | "decoding"
> & {
  priorityMode?: GameImagePriority;
};

const imageLoadingByPriority: Record<
  GameImagePriority,
  Partial<Pick<ImageProps, "loading" | "preload" | "fetchPriority" | "decoding">>
> = {
  critical: {
    preload: true,
    fetchPriority: "high",
    decoding: "async",
  },
  visible: {
    loading: "eager",
    preload: false,
    fetchPriority: "auto",
    decoding: "async",
  },
  deferred: {
    loading: "lazy",
    preload: false,
    fetchPriority: "low",
    decoding: "async",
  },
};

export function GameImage({
  alt,
  priorityMode = "visible",
  sizes,
  quality = 80,
  ...props
}: GameImageProps) {
  const loadingProps = imageLoadingByPriority[priorityMode];

  return (
    <Image
      {...props}
      alt={alt}
      {...loadingProps}
      sizes={sizes}
      quality={quality}
    />
  );
}
