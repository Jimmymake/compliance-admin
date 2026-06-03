import Image from 'next/image';

type BrandLogoProps = {
  className?: string;
  inverse?: boolean;
};

export default function BrandLogo({ className = '', inverse = false }: BrandLogoProps) {
  const textColor = inverse ? 'text-white' : 'text-slate-800';
  const ruleColor = inverse ? 'bg-white' : 'bg-slate-800';
  const networkColor = inverse ? 'text-white' : 'text-[#7a2442]';

  return (
    <div className={`inline-flex items-center gap-4 ${className}`}>
      <Image
        src="/10.png"
        alt="Mamlaka Hub Spoke logo"
        width={48}
        height={48}
        priority
        className={`h-12 w-12 object-contain ${inverse ? 'brightness-0 invert' : ''}`}
      />
      <div className="leading-none">
        <p className={`text-sm font-bold uppercase tracking-[0.16em] ${textColor}`}>
          Mamlaka Hub
        </p>
        <div className="my-1 flex items-center gap-2">
          <span className={`h-px w-6 ${ruleColor}`} />
          <p className={`text-sm font-bold uppercase tracking-[0.3em] ${textColor}`}>
            Spoke
          </p>
          <span className={`h-px w-6 ${ruleColor}`} />
        </div>
        <p className={`mt-2 text-[10px] font-bold uppercase tracking-[0.42em] ${networkColor}`}>
          Trade Network
        </p>
      </div>
    </div>
  );
}
