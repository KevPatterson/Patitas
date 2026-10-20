import { useState, useRef } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Button } from './button';
import { CatLoader } from './cat-loader';

type AvatarUploadProps = {
  currentAvatarUrl?: string | null;
  userName?: string;
  onUpload: (file: File) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function AvatarUpload({ currentAvatarUrl, userName, onUpload, onDelete }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Por favor selecciona una imagen válida (JPG, PNG o WebP)');
      return;
    }

    // Validar tamaño (2MB máximo)
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen debe ser menor a 2MB');
      return;
    }

    // Mostrar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Subir archivo
    setUploading(true);
    try {
      await onUpload(file);
    } catch (error) {
      console.error('Error al subir avatar:', error);
      alert('No se pudo subir la imagen. Intenta de nuevo.');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!window.confirm('¿Eliminar tu foto de perfil?')) return;

    setDeleting(true);
    try {
      await onDelete();
      setPreviewUrl(null);
    } catch (error) {
      console.error('Error al eliminar avatar:', error);
      alert('No se pudo eliminar la imagen. Intenta de nuevo.');
    } finally {
      setDeleting(false);
    }
  };

  const displayUrl = previewUrl || currentAvatarUrl;
  const initial = userName?.[0]?.toUpperCase() || '?';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        {/* Avatar */}
        <div className="size-32 rounded-3xl overflow-hidden border-4 border-foreground/10 shadow-lg bg-linear-to-br from-orange to-turquoise flex items-center justify-center">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Avatar"
              className="size-full object-cover"
            />
          ) : (
            <span className="text-5xl font-display font-extrabold text-white">
              {initial}
            </span>
          )}
        </div>

        {/* Overlay de carga */}
        {(uploading || deleting) && (
          <div className="absolute inset-0 rounded-3xl bg-ink/80 flex items-center justify-center">
            <CatLoader size="sm" />
          </div>
        )}

        {/* Botón de cambiar (overlay) */}
        {!uploading && !deleting && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 rounded-3xl bg-ink/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-base"
          >
            <Camera className="size-8 text-white" />
          </button>
        )}
      </div>

      {/* Botones de acción */}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Seleccionar foto de perfil"
        />
        
        <Button
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || deleting}
          className="gap-2"
        >
          <Camera className="size-4" />
          {currentAvatarUrl ? 'Cambiar foto' : 'Agregar foto'}
        </Button>

        {(currentAvatarUrl || previewUrl) && onDelete && (
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={uploading || deleting}
            className="gap-2"
          >
            <Trash2 className="size-4" />
            Eliminar
          </Button>
        )}
      </div>

      <p className="text-xs text-foreground/60 text-center max-w-xs">
        Tamaño máximo: 2MB · Formatos: JPG, PNG, WebP
      </p>
    </div>
  );
}
