import BrandLogo from '@/app/components/BrandLogo';

export default function HeroSection() {
  return (
    <div className="hidden lg:flex flex-col justify-between bg-[#6366f1] p-12 text-white">
      <div className="h-20 flex items-center">
        <BrandLogo inverse />
      </div>

      <div>
        <h2 className="text-5xl font-bold mb-4 leading-tight">Compliance </h2>
        <p className="text-lg text-white/80 mb-8">Compliance review workspace</p>
        
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-white"></div>
          <div className="w-3 h-3 rounded-full bg-white/50"></div>
          <div className="w-3 h-3 rounded-full bg-white/50"></div>
        </div>
      </div>

      <div className="text-white/80 text-sm">
        © 2026 Mamlaka Hub & Spoke. All rights reserved. Licensed and regulated by the CBK.
      </div>
    </div>
  );
}
