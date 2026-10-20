import { PawPrint } from 'lucide-react';
import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  illustration?: 'cat' | 'dog' | 'paw';
};

export function EmptyState({ 
  title, 
  description, 
  icon, 
  action,
  illustration = 'paw' 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-6 relative">
        {illustration === 'paw' && (
          <div className="size-20 flex items-center justify-center text-foreground/20">
            <PawPrint className="size-16" strokeWidth={1.5} />
          </div>
        )}
        {illustration === 'cat' && (
          <div className="text-6xl animate-float">🐱</div>
        )}
        {illustration === 'dog' && (
          <div className="text-6xl animate-float">🐶</div>
        )}
        {icon && (
          <div className="size-20 flex items-center justify-center text-foreground/20">
            {icon}
          </div>
        )}
      </div>
      
      <h3 className="font-display text-2xl font-extrabold text-foreground mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-foreground/60 max-w-md mb-6 leading-relaxed">
          {description}
        </p>
      )}
      
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
}

type ErrorStateProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
};

export function ErrorState({ 
  title = '¡Ups! Esta patita tropezó', 
  description = 'Algo salió mal. Por favor, inténtalo nuevamente.',
  action 
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-6xl mb-4 animate-shake">🐶</div>
      
      <h3 className="font-display text-2xl font-extrabold text-foreground mb-2">
        {title}
      </h3>
      
      <p className="text-foreground/60 max-w-md mb-6 leading-relaxed">
        {description}
      </p>
      
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
}
