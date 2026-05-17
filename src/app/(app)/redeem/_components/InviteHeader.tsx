import Image from "next/image";

export function InvitePageHeader() {
  return (
    <header className="w-full max-w-lg h-[47.29px] border-b border-white/10 bg-[#191919] shrink-0 px-4 mx-auto flex items-center justify-center pt-3 pb-3">
      <div className="relative w-[122px] h-[23px]">
        <Image
          src="/logo-onboarding.webp"
          alt="Waffles Logo"
          fill
          priority
        />
      </div>
    </header>
  );
}
