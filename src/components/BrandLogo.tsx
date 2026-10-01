type BrandLogoProps = {
  className?: string;
  size?: number;
  showName?: boolean;
};

export default function BrandLogo({ className = '', size = 35, showName = true }: BrandLogoProps) {
  return <span className={`brand-lockup ${className}`}>
    <img className="brand-image" src="/brand/tutorspace-app-icon.svg" width={size} height={size} alt={showName ? '' : 'TutorSpace'} aria-hidden={showName ? true : undefined} />
    {showName && <span className="brand-name">TutorSpace</span>}
  </span>;
}
