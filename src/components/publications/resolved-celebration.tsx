import { Heart, Home, PawPrint, PartyPopper } from 'lucide-react';

type ResolvedCelebrationProps = {
  petName: string;
};

export function ResolvedCelebration({ petName }: ResolvedCelebrationProps) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border-2 p-8 text-center shadow-sm"
      style={{
        borderColor: '#CFEFE6',
        background: 'linear-gradient(to bottom right, rgba(14,124,102,0.1), hsl(var(--background)), rgba(14,124,102,0.2))',
      }}
    >
      <div
        className="absolute inset-0 -z-10 blur-2xl"
        style={{
          background: 'radial-gradient(circle at 30% 20%, rgba(14,124,102,0.12), transparent 50%)',
        }}
      />

      <div className="space-y-4">
        <div
          className="mx-auto flex size-16 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: '#0E7C66' }}
        >
          <PartyPopper className="size-8" aria-hidden="true" />
        </div>

        <h2
          className="font-display text-3xl font-extrabold"
          style={{ fontFamily: '"Baloo 2", cursive', color: '#0E7C66' }}
        >
          ¡{petName} está de vuelta en casa!
        </h2>

        <p
          className="mx-auto max-w-xl text-base leading-7"
          style={{ fontFamily: 'Figtree, sans-serif', color: 'rgba(11,59,60,0.8)' }}
        >
          Gracias a todas las personas que ayudaron a compartir este caso. Juntos hacemos que las mascotas regresen con sus familias.
        </p>

        <div className="flex items-center justify-center gap-3" style={{ color: '#FF6B35' }}>
          <Heart className="size-6 animate-pulse" aria-hidden="true" />
          <PawPrint className="size-6 animate-pulse [animation-delay:100ms]" aria-hidden="true" />
          <Home className="size-6 animate-pulse [animation-delay:200ms]" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
