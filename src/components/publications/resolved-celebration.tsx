import { Heart, Home, PawPrint, PartyPopper } from 'lucide-react';

type ResolvedCelebrationProps = {
  petName: string;
};

export function ResolvedCelebration({ petName }: ResolvedCelebrationProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-found/30 bg-linear-to-br from-found/10 via-app to-found/20 p-8 text-center shadow-sm">
      <div className="absolute inset-0 -z-10 bg-found/10 blur-2xl" />

      <div className="space-y-4">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-found text-white">
          <PartyPopper className="size-8" aria-hidden="true" />
        </div>

        <h2
          className="font-display text-3xl font-extrabold text-found"
          style={{ fontFamily: '"Baloo 2", cursive' }}
        >
          ¡{petName} está de vuelta en casa!
        </h2>

        <p
          className="mx-auto max-w-xl text-base leading-7 text-foreground/80"
          style={{ fontFamily: 'Figtree, sans-serif' }}
        >
          Gracias a todas las personas que ayudaron a compartir este caso. Juntos hacemos que las mascotas regresen con sus familias.
        </p>

        <div className="flex items-center justify-center gap-3 text-orange">
          <Heart className="size-6 animate-pulse" aria-hidden="true" />
          <PawPrint className="size-6 animate-pulse [animation-delay:100ms]" aria-hidden="true" />
          <Home className="size-6 animate-pulse [animation-delay:200ms]" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
