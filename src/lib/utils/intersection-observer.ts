import { useEffect, useRef, useState } from 'react';

/**
 * Hook para detectar cuando un elemento entra al viewport
 * Útil para scroll animations
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Solo activar una vez cuando entra
        if (entry.isIntersecting && !isIntersecting) {
          setIsIntersecting(true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [isIntersecting, options]);

  return [ref, isIntersecting];
}

/**
 * Hook para múltiples elementos con stagger
 */
export function useStaggerAnimation(count: number, delay = 100) {
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());
  const [ref, isIntersecting] = useIntersectionObserver();

  useEffect(() => {
    if (!isIntersecting) return;

    // Animar elementos uno por uno con delay
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    
    for (let i = 0; i < count; i++) {
      const timeout = setTimeout(() => {
        setVisibleItems((prev) => new Set([...prev, i]));
      }, i * delay);
      
      timeouts.push(timeout);
    }

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [isIntersecting, count, delay]);

  return { ref, visibleItems, isIntersecting };
}

/**
 * Verificar si el usuario prefiere menos movimiento
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
