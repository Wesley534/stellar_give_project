
export function BlockchainIcon({ size = 24, className = "" }: { size?: number, className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer Hexagon/Node Frame */}
      <path 
        d="M12 2L20.6603 7V17L12 22L3.33975 17V7L12 2Z" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        style={{ opacity: 0.4 }}
      />
      {/* Central Core */}
      <path 
        d="M12 8L16 10.5V14.5L12 17L8 14.5V10.5L12 8Z" 
        fill="currentColor" 
      />
      {/* Connectors */}
      <path d="M12 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 22V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20.6603 7L16 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20.6603 17L16 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3.33975 7L8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3.33975 17L8 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
