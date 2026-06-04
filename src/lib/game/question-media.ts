const QUESTION_MEDIA_TRANSFORMATION = "c_limit,w_960,h_540,q_auto:eco,f_auto";
const CLOUDINARY_IMAGE_UPLOAD_PREFIX =
  /^https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(.+)$/;

const isCloudinaryVersionSegment = (segment: string) => /^v\d+$/.test(segment);

const isCloudinaryTransformationSegment = (segment: string) =>
  segment
    .split(",")
    .some((part) =>
      /^(ar|b|bo|c|co|dpr|e|f|fl|g|h|l|o|q|r|t|u|w|x|y|z)_/.test(part),
    );

export function isCloudinaryQuestionMediaUrl(url: string | null | undefined) {
  return Boolean(url?.match(CLOUDINARY_IMAGE_UPLOAD_PREFIX));
}

export function normalizeQuestionMediaUrl(url: string | null | undefined) {
  if (!url) return null;

  const match = url.match(CLOUDINARY_IMAGE_UPLOAD_PREFIX);
  if (!match) return url;

  const [, cloudName, uploadPath] = match;
  const segments = uploadPath.split("/").filter(Boolean);
  let assetStartIndex = 0;

  while (
    assetStartIndex < segments.length &&
    !isCloudinaryVersionSegment(segments[assetStartIndex]) &&
    isCloudinaryTransformationSegment(segments[assetStartIndex])
  ) {
    assetStartIndex += 1;
  }

  const assetPath = segments.slice(assetStartIndex).join("/");
  if (!assetPath) return url;

  return `https://res.cloudinary.com/${cloudName}/image/upload/${QUESTION_MEDIA_TRANSFORMATION}/${assetPath}`;
}
