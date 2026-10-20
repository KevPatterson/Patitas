import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, PauseCircle, PlayCircle, Eye, AlertTriangle, Shield, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import { Button } from '../ui/button';
import type { ExternalSource } from '../../types/index';

const PLATFORM_LABELS: Record<'TELEGRAM' | 'FACEBOOK_PUBLIC', string> = {
  TELEGRAM: 'Telegram',
  FACEBOOK_PUBLIC: 'Facebook Público',
};

const PLATFORM_ICONS: Record<'TELEGRAM' | 'FACEBOOK_PUBLIC', React.ReactNode> = {
  TELEGRAM: <ExternalLink className="size-4 text-orange" />,
  FACEBOOK_PUBLIC: <Shield className="size-4 text-orange" />,
};

export function ExternalSourcesManager() {
  const [sources, setSources] = useState<ExternalSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSource, setEditingSource] = useState<ExternalSource | null>(null);
  const [formData, setFormData] = useState({
    platform: 'TELEGRAM' as 'TELEGRAM' | 'FACEBOOK_PUBLIC',
    handle_or_url: '',
    name: '',
    province: '',
    is_active: true,
    is_trusted: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('external_sources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSources(data || []);
    } catch (error) {
      console.error('Error loading sources:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingSource(null);
    setFormData({
      platform: 'TELEGRAM',
      handle_or_url: '',
      name: '',
      province: '',
      is_active: true,
      is_trusted: false,
    });
    setFormError(null);
    setShowModal(true);
  }

  function openEditModal(source: ExternalSource) {
    setEditingSource(source);
    setFormData({
      platform: source.platform,
      handle_or_url: source.handle_or_url,
      name: source.name ?? '',
      province: source.province ?? '',
      is_active: source.is_active,
      is_trusted: source.is_trusted,
    });
    setFormError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingSource(null);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Validaciones
    if (!formData.handle_or_url.trim()) {
      setFormError('El handle/URL es requerido');
      return;
    }

    if (formData.platform === 'TELEGRAM' && !formData.handle_or_url.startsWith('@')) {
      setFormError('En Telegram, el handle debe empezar con @');
      return;
    }

    if (formData.platform === 'FACEBOOK_PUBLIC' && !formData.handle_or_url.startsWith('https://')) {
      setFormError('En Facebook, debe ser una URL HTTPS completa');
      return;
    }

    try {
      if (editingSource) {
        const { error } = await supabase
          .from('external_sources')
          .update({
            name: formData.name || null,
            province: formData.province || null,
            is_active: formData.is_active,
            is_trusted: formData.is_trusted,
          })
          .eq('id', editingSource.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('external_sources')
          .insert({
            platform: formData.platform,
            handle_or_url: formData.handle_or_url.trim(),
            name: formData.name || null,
            province: formData.province || null,
            is_active: formData.is_active,
            is_trusted: formData.is_trusted,
          });

        if (error) {
          if (error.code === '23505') { // unique violation
            setFormError('Ya existe una fuente con ese platform + handle');
            return;
          }
          throw error;
        }
      }

      closeModal();
      await loadSources();
    } catch (error) {
      console.error('Error saving source:', error);
      setFormError('Error guardando la fuente');
    }
  }

  async function toggleActive(source: ExternalSource) {
    setActionLoadingId(source.id);
    try {
      const { error } = await supabase
        .from('external_sources')
        .update({ is_active: !source.is_active })
        .eq('id', source.id);

      if (error) throw error;
      await loadSources();
    } catch (error) {
      console.error('Error toggling source:', error);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function deleteSource(source: ExternalSource) {
    if (!confirm(`¿Eliminar la fuente "${source.name ?? source.handle_or_url}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setActionLoadingId(source.id);
    try {
      const { error } = await supabase
        .from('external_sources')
        .delete()
        .eq('id', source.id);

      if (error) throw error;
      await loadSources();
    } catch (error) {
      console.error('Error deleting source:', error);
    } finally {
      setActionLoadingId(null);
    }
  }

  function getStatusBadge(source: ExternalSource): React.ReactNode {
    if (!source.is_active) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-foreground/10 text-foreground">
          <PauseCircle className="size-3" />
          Inactiva
        </span>
      );
    }
    if (source.error_count > 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-orange/10 text-orange">
          <AlertTriangle className="size-3" />
          {source.error_count} error{source.error_count > 1 ? 'es' : ''}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-found/10 text-found">
        <PlayCircle className="size-3" />
        Activa
      </span>
    );
  }

  function getTrustedBadge(source: ExternalSource): React.ReactNode {
    if (source.is_trusted) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-purple/10 text-purple-700">
          <Shield className="size-3" />
          Confiable
        </span>
      );
    }
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 text-orange animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Gestión de fuentes externas</h2>
          <p className="text-foreground/60 text-sm">Canales/grupos de Telegram y páginas públicas de Facebook a monitorear</p>
        </div>
        <Button onClick={openCreateModal} className="gap-2">
          <Plus className="size-4" />
          Nueva fuente
        </Button>
      </div>

      {/* Tabla de fuentes */}
      <div className="rounded-2xl border-2 border-foreground/10 bg-surface overflow-hidden">
        {sources.length === 0 ? (
          <div className="text-center py-12">
            <ExternalLink className="size-16 text-foreground/20 mx-auto mb-4" />
            <h3 className="font-display text-lg font-bold text-foreground">No hay fuentes configuradas</h3>
            <p className="text-foreground/60 mt-1">Agrega tu primera fuente para empezar a importar contenido.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-foreground/5">
                <tr className="text-left text-sm font-semibold text-foreground/70">
                  <th className="px-4 py-3">Plataforma</th>
                  <th className="px-4 py-3">Handle / URL</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Provincia</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Confiable</th>
                  <th className="px-4 py-3">Última ejecución</th>
                  <th className="px-4 py-3">Errores</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/10">
                {sources.map((source) => (
                  <tr key={source.id} className="hover:bg-foreground/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        {PLATFORM_ICONS[source.platform]}
                        <span className="font-medium text-foreground capitalize">{PLATFORM_LABELS[source.platform].toLowerCase()}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-sm text-foreground/80 bg-foreground/5 px-2 py-1 rounded">{source.handle_or_url}</code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-foreground">{source.name ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-foreground/70">{source.province ?? 'Todas'}</span>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(source)}</td>
                    <td className="px-4 py-3">{getTrustedBadge(source)}</td>
                    <td className="px-4 py-3 text-foreground/60 text-sm">
                      {source.last_run_at ? new Date(source.last_run_at).toLocaleString('es-ES') : 'Nunca'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={source.error_count > 0 ? 'text-lost font-semibold' : 'text-found font-semibold'}>
                        {source.error_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(source.handle_or_url.startsWith('http') ? source.handle_or_url : `https://t.me/${source.handle_or_url.replace('@', '')}`, '_blank')}
                          title="Ver fuente"
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(source)}
                          title="Editar"
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive(source)}
                          disabled={actionLoadingId === source.id}
                          loading={actionLoadingId === source.id}
                          title={source.is_active ? 'Pausar' : 'Activar'}
                        >
                          {source.is_active ? <PauseCircle className="size-4" /> : <PlayCircle className="size-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSource(source)}
                          disabled={actionLoadingId === source.id}
                          loading={actionLoadingId === source.id}
                          className="text-lost hover:text-lost-dark hover:bg-lost/10"
                          title="Eliminar"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface rounded-3xl border-2 border-foreground/10 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-bold text-foreground">
                {editingSource ? 'Editar fuente' : 'Nueva fuente'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 rounded-xl hover:bg-foreground/5 transition"
              >
                <ExternalLink className="size-5 text-foreground/50" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="flex items-center gap-2 text-lost text-sm bg-lost/10 px-3 py-2 rounded-lg">
                  <AlertTriangle className="size-4" />
                  <span>{formError}</span>
                </div>
              )}

              <label className="space-y-2 text-sm font-semibold text-foreground">
                <span>Plataforma</span>
                <select
                  className="w-full h-10 rounded-2xl border-2 border-foreground/10 bg-surface px-3 text-base text-foreground"
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value as 'TELEGRAM' | 'FACEBOOK_PUBLIC' })}
                >
                  <option value="TELEGRAM">Telegram (canal/grupo público @handle)</option>
                  <option value="FACEBOOK_PUBLIC">Facebook Público (URL de página)</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-semibold text-foreground">
                <span>Handle / URL</span>
                <input
                  type="text"
                  className="w-full h-10 rounded-2xl border-2 border-foreground/10 bg-surface px-3 text-base text-foreground"
                  placeholder={formData.platform === 'TELEGRAM' ? '@mascotas_perdidas' : 'https://facebook.com/pagina'}
                  value={formData.handle_or_url}
                  onChange={(e) => setFormData({ ...formData, handle_or_url: e.target.value })}
                  required
                />
                <p className="text-xs text-foreground/50">
                  {formData.platform === 'TELEGRAM'
                    ? 'Username del canal/grupo público (con @)'
                    : 'URL completa de la página pública de Facebook'}
                </p>
              </label>

              <label className="space-y-2 text-sm font-semibold text-foreground">
                <span>Nombre visible (opcional)</span>
                <input
                  type="text"
                  className="w-full h-10 rounded-2xl border-2 border-foreground/10 bg-surface px-3 text-base text-foreground"
                  placeholder="Mascotas Perdidas La Habana"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </label>

              <label className="space-y-2 text-sm font-semibold text-foreground">
                <span>Provincia (opcional, filtro geográfico)</span>
                <select
                  className="w-full h-10 rounded-2xl border-2 border-foreground/10 bg-surface px-3 text-base text-foreground"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                >
                  <option value="">Todas las provincias</option>
                  <option value="Pinar del Río">Pinar del Río</option>
                  <option value="Artemisa">Artemisa</option>
                  <option value="La Habana">La Habana</option>
                  <option value="Mayabeque">Mayabeque</option>
                  <option value="Matanzas">Matanzas</option>
                  <option value="Villa Clara">Villa Clara</option>
                  <option value="Cienfuegos">Cienfuegos</option>
                  <option value="Sancti Spíritus">Sancti Spíritus</option>
                  <option value="Ciego de Ávila">Ciego de Ávila</option>
                  <option value="Camagüey">Camagüey</option>
                  <option value="Las Tunas">Las Tunas</option>
                  <option value="Holguín">Holguín</option>
                  <option value="Granma">Granma</option>
                  <option value="Santiago de Cuba">Santiago de Cuba</option>
                  <option value="Guantánamo">Guantánamo</option>
                  <option value="Isla de la Juventud">Isla de la Juventud</option>
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-foreground/20 text-orange focus:ring-orange/20"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <span className="text-sm font-medium text-foreground">Activa</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-foreground/20 text-purple-600 focus:ring-purple/20"
                    checked={formData.is_trusted}
                    onChange={(e) => setFormData({ ...formData, is_trusted: e.target.checked })}
                  />
                  <span className="text-sm font-medium text-foreground">Confiable (auto-publicar si confidence ≥ 85%)</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={closeModal} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" loading={actionLoadingId === (editingSource?.id ?? 'new')} className="flex-1">
                  {editingSource ? 'Guardar cambios' : 'Crear fuente'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExternalSourcesManager;