import { useState } from 'react';
import { Share2, X, Link2, MessageCircle, Send, Check } from 'lucide-react';
import { Button } from '../ui/button';
import {
  buildPublicationShareData,
  canUseWebShare,
  copyToClipboard,
  shareViaFacebook,
  shareViaTelegram,
  shareViaWebAPI,
  shareViaWhatsApp,
} from '../../lib/utils/share';

type ShareMenuProps = {
  publication: {
    title: string;
    type: string;
    location: string;
    slug: string;
  };
  className?: string;
};

export function ShareMenu({ publication, className }: ShareMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareData = buildPublicationShareData(publication);

  const handleWebShare = async () => {
    const success = await shareViaWebAPI(shareData);
    if (success) {
      setShowMenu(false);
    }
  };

  const handleCopy = async () => {
    try {
      await copyToClipboard(shareData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Error al copiar
    }
  };
  return (
    <div className={['relative', className].filter(Boolean).join(' ')}>
      <Button type="button" variant="secondary" onClick={() => setShowMenu(!showMenu)} className="w-full">
        {showMenu ? (
          <>
            <X className="size-4" aria-hidden="true" /> Cerrar
          </>
        ) : (
          <>
            <Share2 className="size-4" aria-hidden="true" /> Compartir
          </>
        )}
      </Button>
      {showMenu ? (
        <div className="absolute right-0 top-full z-10 mt-3 w-64 space-y-2 rounded-2xl border-2 border-[#CFEFE6] bg-white p-4 shadow-[0_18px_50px_rgba(11,59,60,0.08)]">
          {canUseWebShare() ? (
            <button
              type="button"
              onClick={handleWebShare}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[#0B3B3C] hover:bg-[#F5FBF9]"
            >
              <Share2 className="size-4" aria-hidden="true" />
              <span>Compartir</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => shareViaWhatsApp(shareData.text, shareData.url)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[#0B3B3C] hover:bg-[#F5FBF9]"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            <span>WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={() => shareViaTelegram(shareData.text, shareData.url)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[#0B3B3C] hover:bg-[#F5FBF9]"
          >
            <Send className="size-4" aria-hidden="true" />
            <span>Telegram</span>
          </button>
          <button
            type="button"
            onClick={() => shareViaFacebook(shareData.url)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[#0B3B3C] hover:bg-[#F5FBF9]"
          >
            <Share2 className="size-4" aria-hidden="true" />
            <span>Facebook</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[#0B3B3C] hover:bg-[#F5FBF9]"
          >
            {copied ? <Check className="size-4 text-[#0E7C66]" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
            <span>{copied ? 'Copiado' : 'Copiar enlace'}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
