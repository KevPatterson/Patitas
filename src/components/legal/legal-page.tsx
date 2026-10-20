import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight, LifeBuoy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LinkButton } from '../ui/button';

export const LEGAL_CONTACT_EMAIL = 'kevinpatterson618@gmail.com';

type Accent = 'orange' | 'turquoise' | 'purple' | 'found';

type AccentStyles = {
  hero: string;
  icon: string;
  chip: string;
  blob: string;
  blobAlt: string;
};

const ACCENTS: Record<Accent, AccentStyles> = {
  orange: {
    hero: 'from-orange/10 via-app to-turquoise/10',
    icon: 'text-orange',
    chip: 'bg-orange/10',
    blob: 'bg-orange/20',
    blobAlt: 'bg-purple/15',
  },
  turquoise: {
    hero: 'from-turquoise/10 via-app to-orange/10',
    icon: 'text-orange-dark',
    chip: 'bg-turquoise/20',
    blob: 'bg-turquoise/20',
    blobAlt: 'bg-found/15',
  },
  purple: {
    hero: 'from-purple/10 via-app to-orange/10',
    icon: 'text-purple',
    chip: 'bg-purple/10',
    blob: 'bg-purple/20',
    blobAlt: 'bg-orange/15',
  },
  found: {
    hero: 'from-found/10 via-app to-orange/10',
    icon: 'text-found',
    chip: 'bg-found/10',
    blob: 'bg-found/20',
    blobAlt: 'bg-turquoise/15',
  },
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  icon: LucideIcon;
  accent: Accent;
  sections: { id: string; label: string }[];
  related: { href: string; label: string }[];
  children: ReactNode;
};

export function LegalPage({
  eyebrow,
  title,
  intro,
  updated,
  icon: Icon,
  accent,
  sections,
  related,
  children,
}: LegalPageProps) {
  const styles = ACCENTS[accent];

  return (
    <div className="mx-auto max-w-4xl space-y-10 py-10">
      <div
        className={`relative overflow-hidden rounded-3xl border-2 border-foreground/10 bg-linear-to-br ${styles.hero} p-8 shadow-md md:p-12`}
      >
        <div className={`blob-decoration absolute right-5 top-5 size-32 ${styles.blob}`} />
        <div
          className={`blob-decoration absolute bottom-5 left-5 size-24 ${styles.blobAlt}`}
          style={{ animationDelay: '2s' }}
        />

        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className={`size-6 ${styles.icon} animate-paw-bounce`} aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground/60">
              {eyebrow}
            </span>
          </div>
          <h1 className="font-display text-4xl font-extrabold text-foreground md:text-5xl">{title}</h1>
          <p className="max-w-2xl text-lg leading-relaxed text-foreground/70">{intro}</p>
          <p className="inline-flex items-center rounded-full border-2 border-foreground/10 bg-surface px-3.5 py-1.5 text-sm font-semibold text-foreground/70">
            Última actualización: {updated}
          </p>
        </div>
      </div>

      <nav
        aria-labelledby="indice-contenido"
        className="rounded-2xl border-2 border-foreground/10 bg-surface p-6 shadow-md"
      >
        <h2 id="indice-contenido" className="mb-4 font-display text-lg font-extrabold text-foreground">
          En esta página
        </h2>
        <ol className="grid gap-2 sm:grid-cols-2">
          {sections.map((section, index) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground/75 transition-colors duration-base hover:bg-highlight hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
              >
                <span className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md text-xs font-bold text-foreground/70 ${styles.chip}`}>
                  {index + 1}
                </span>
                <span>{section.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="space-y-10">{children}</article>

      <section aria-labelledby="otros-documentos" className="space-y-3">
        <h2 id="otros-documentos" className="font-display text-xl font-extrabold text-foreground">
          Otros documentos
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3" role="list">
          {related.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                className="flex h-full items-center justify-between gap-2 rounded-2xl border-2 border-foreground/10 bg-surface px-4 py-3 text-sm font-semibold text-foreground/80 transition-all duration-base hover:-translate-y-0.5 hover:border-orange/40 hover:text-foreground hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
              >
                {item.label}
                <ChevronRight className="size-4 shrink-0 text-orange" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="rounded-3xl border-2 border-foreground/10 bg-surface p-8 text-center shadow-md">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-orange/10 text-orange">
          <LifeBuoy className="size-7" aria-hidden="true" />
        </div>
        <h2 className="font-display text-2xl font-extrabold text-foreground">
          ¿Tienes dudas sobre este documento?
        </h2>
        <p className="mx-auto mt-2 max-w-xl leading-relaxed text-foreground/70">
          Escríbenos y te explicamos cualquier punto sin tecnicismos. Si detectas un error o algo
          desactualizado, también queremos saberlo.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <LinkButton href="/contacto" variant="primary">
            Escribir a Patitas
          </LinkButton>
          <LinkButton href="/preguntas-frecuentes" variant="ghost">
            Preguntas frecuentes
          </LinkButton>
        </div>
      </div>
    </div>
  );
}

type LegalSectionProps = {
  id: string;
  title: string;
  children: ReactNode;
};

export function LegalSection({ id, title, children }: LegalSectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-28 space-y-4">
      <h2
        id={`${id}-titulo`}
        className="font-display text-2xl font-extrabold text-foreground"
      >
        {title}
      </h2>
      <div className="space-y-4 leading-relaxed text-foreground/80">{children}</div>
    </section>
  );
}

type LegalBulletsProps = {
  items: ReactNode[];
};

export function LegalBullets({ items }: LegalBulletsProps) {
  return (
    <ul className="space-y-2.5" role="list">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-foreground/30" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

type LegalCalloutProps = {
  icon: LucideIcon;
  title: string;
  tone?: 'info' | 'warning' | 'success';
  children: ReactNode;
};

const TONES = {
  info: {
    wrapper: 'border-orange/25 bg-orange/5',
    icon: 'bg-orange/10 text-orange',
  },
  warning: {
    wrapper: 'border-lost/25 bg-lost/5',
    icon: 'bg-lost/10 text-lost',
  },
  success: {
    wrapper: 'border-found/25 bg-found/5',
    icon: 'bg-found/10 text-found',
  },
};

export function LegalCallout({ icon: Icon, title, tone = 'info', children }: LegalCalloutProps) {
  const styles = TONES[tone];

  return (
    <div className={`flex gap-4 rounded-2xl border-2 p-5 ${styles.wrapper}`}>
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="font-display font-bold text-foreground">{title}</p>
        <div className="text-sm leading-relaxed text-foreground/80">{children}</div>
      </div>
    </div>
  );
}

export function LegalContactLink() {
  return (
    <a
      href={`mailto:${LEGAL_CONTACT_EMAIL}`}
      className="font-semibold text-orange-dark underline decoration-orange/40 underline-offset-4 transition-colors hover:text-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
    >
      {LEGAL_CONTACT_EMAIL}
    </a>
  );
}
