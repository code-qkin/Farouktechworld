import React from 'react';

const NairaSign = ({ size = 24, className = "", color = "currentColor", ...props }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
        {...props}
    >
        <path d="M6 21V3L18 21V3 M4 10h16 M4 14h16" />
    </svg>
);

export default NairaSign;
