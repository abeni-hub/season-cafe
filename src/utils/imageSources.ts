const responsiveWidths = [320, 480, 640, 960, 1280, 1600] as const;

export function getResponsiveImageSrcSet(src: string): string | undefined {
  if (!src.startsWith("https://images.unsplash.com/")) return undefined;

  const imageUrl = new URL(src);
  return responsiveWidths
    .map((width) => {
      const variant = new URL(imageUrl);
      variant.searchParams.set("w", String(width));
      return `${variant.toString()} ${width}w`;
    })
    .join(", ");
}
