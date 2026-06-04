import { describe, expect, it } from "vitest";
import {
  isCloudinaryQuestionMediaUrl,
  normalizeQuestionMediaUrl,
} from "@/lib/game/question-media";

describe("question media URLs", () => {
  it("normalizes original Cloudinary upload URLs for mobile gameplay", () => {
    expect(
      normalizeQuestionMediaUrl(
        "https://res.cloudinary.com/demo/image/upload/v1710000000/waffles/questions/movie-scene.png",
      ),
    ).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_limit,w_960,h_540,q_auto:eco,f_auto/v1710000000/waffles/questions/movie-scene.png",
    );
  });

  it("replaces existing Cloudinary transformations", () => {
    expect(
      normalizeQuestionMediaUrl(
        "https://res.cloudinary.com/demo/image/upload/c_limit,h_720,q_auto:good,w_1280/f_auto/waffles/questions/movie-scene.png",
      ),
    ).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_limit,w_960,h_540,q_auto:eco,f_auto/waffles/questions/movie-scene.png",
    );
  });

  it("leaves non-Cloudinary URLs unchanged", () => {
    expect(normalizeQuestionMediaUrl("/images/movies-cover.webp")).toBe(
      "/images/movies-cover.webp",
    );
  });

  it("detects Cloudinary image upload URLs", () => {
    expect(
      isCloudinaryQuestionMediaUrl(
        "https://res.cloudinary.com/demo/image/upload/waffles/questions/a.webp",
      ),
    ).toBe(true);
    expect(isCloudinaryQuestionMediaUrl("https://example.com/a.webp")).toBe(
      false,
    );
  });
});
