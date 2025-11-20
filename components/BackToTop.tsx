import React, { useState, useEffect } from 'react';
import { ArrowUpIcon } from './icons';

export const BackToTop: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);

    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <>
      {isVisible && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 bg-[#4A70A9] text-white p-3 rounded-full shadow-lg hover:bg-[#3e6094] transition-all duration-300 z-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4A70A9]"
          aria-label="Back to top"
        >
          <ArrowUpIcon className="h-6 w-6" />
        </button>
      )}
    </>
  );
};
