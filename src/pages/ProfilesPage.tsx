import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, User } from 'lucide-react';
import { api } from '../services/apiAdapter';
import type { Astronaut, PageId, ProfileHistoryEntry } from '../types/domain';

interface ProfilesPageProps {
  astronauts: Astronaut[];
  selectedAstronautId: number | null;
  onSelectAstronaut: (id: number | null) => void;
  onRefresh: () => Promise<void>;
  onNavigate: (page: PageId) => void;
}

export const ProfilesPage: React.FC<ProfilesPageProps> = ({
  astronauts,
  selectedAstronautId,
  onSelectAstronaut,
  onRefresh,
  onNavigate,
}) => {
  const activeId = selectedAstronautId ?? astronauts[0]?.id ?? null;
  const [detail, setDetail] = useState<{ profile: Astronaut; history: ProfileHistoryEntry[]; recent_health_count: number } | null>(null);
  const [showForm, setShowForm] = useState<'create' | 'edit' | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const [formState, setFormState] = useState({
    call_sign: '',
    full_name: '',
    role: 'Mission Specialist',
    mission_name: 'ARTEMIS-SIM-04',
    age_group: '35-39',
    blood_type: 'O+',
    mission_day: 1,
    mission_duration_days: 180,
    notes: '',
  });

  useEffect(() => {
    if (!activeId) {
      setDetail(null);
      return;
    }
    api.getAstronautDetail(activeId).then(setDetail).catch(() => setDetail(null));
  }, [activeId, astronauts]);

  const openCreate = () => {
    setErrorMsg('');
    setFormState({
      call_sign: '',
      full_name: '',
      role: 'Flight Engineer',
      mission_name: 'ARTEMIS-SIM-04',
      age_group: '35-39',
      blood_type: 'O+',
      mission_day: 1,
      mission_duration_days: 180,
      notes: '',
    });
    setShowForm('create');
  };

  const openEdit = (p: Astronaut) => {
    setErrorMsg('');
    setFormState({
      call_sign: p.call_sign,
      full_name: p.full_name,
      role: p.role,
      mission_name: p.mission_name,
      age_group: p.age_group,
      blood_type: p.blood_type,
      mission_day: p.mission_day,
      mission_duration_days: p.mission_duration_days,
      notes: p.notes,
    });
    setShowForm('edit');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    try {
      if (showForm === 'create') {
        const created = await api.createAstronaut({ ...formState, data_source: 'MANUAL', change_source: 'MANUAL_FORM' });
        await onRefresh();
        onSelectAstronaut(created.id);
      } else if (showForm === 'edit' && detail) {
        await api.updateAstronaut(detail.profile.id, { ...formState, change_source: 'MANUAL_FORM' });
        await onRefresh();
        const updatedDetail = await api.getAstronautDetail(detail.profile.id);
        setDetail(updatedDetail);
      }
      setShowForm(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteAstronaut(id);
      setConfirmDeleteId(null);
      if (selectedAstronautId === id) onSelectAstronaut(null);
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-100">Crew Profile Management</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Local SQLite roster with immutable field-level edit history. Synthetic demo profiles are tagged SYNTHETIC.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('voice')}
            className="px-3.5 py-2 text-xs font-medium bg-[#0D111A] border border-slate-700 text-slate-200 rounded-md hover:border-cyan-500/60 transition-colors whitespace-nowrap"
          >
            Voice Profile Entry
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="px-3.5 py-2 text-xs font-medium bg-cyan-500 text-slate-950 rounded-md hover:bg-cyan-400 transition-colors whitespace-nowrap flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Astronaut</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/70 rounded-md">
          {errorMsg}
        </div>
      )}

      {/* Create / Edit Modal Panel */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#0D111A] border border-cyan-500/40 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-display text-sm font-semibold text-slate-100">
              {showForm === 'create' ? 'Create Manual Astronaut Profile' : `Edit Profile · ${formState.call_sign}`}
            </h3>
            <button type="button" onClick={() => setShowForm(null)} className="text-xs text-slate-400 hover:text-slate-200">
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Call Sign</label>
              <input
                required
                disabled={showForm === 'edit'}
                value={formState.call_sign}
                onChange={(e) => setFormState({ ...formState, call_sign: e.target.value })}
                placeholder="e.g. PLT-04"
                className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 text-slate-100 font-mono disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Full Name</label>
              <input
                required
                value={formState.full_name}
                onChange={(e) => setFormState({ ...formState, full_name: e.target.value })}
                placeholder="Crew Name"
                className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Mission Role</label>
              <input
                required
                value={formState.role}
                onChange={(e) => setFormState({ ...formState, role: e.target.value })}
                className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Mission ID</label>
              <input
                required
                value={formState.mission_name}
                onChange={(e) => setFormState({ ...formState, mission_name: e.target.value })}
                className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Age Group</label>
              <input
                value={formState.age_group}
                onChange={(e) => setFormState({ ...formState, age_group: e.target.value })}
                className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Blood Type</label>
              <input
                value={formState.blood_type}
                onChange={(e) => setFormState({ ...formState, blood_type: e.target.value })}
                className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Mission Day</label>
              <input
                type="number"
                min={0}
                max={2000}
                value={formState.mission_day}
                onChange={(e) => setFormState({ ...formState, mission_day: Number(e.target.value) })}
                className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Planned Duration (Days)</label>
              <input
                type="number"
                min={1}
                max={2000}
                value={formState.mission_duration_days}
                onChange={(e) => setFormState({ ...formState, mission_duration_days: Number(e.target.value) })}
                className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 text-slate-100 font-mono"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block text-slate-400 mb-1">Approved Operational Notes</label>
            <textarea
              rows={2}
              value={formState.notes}
              onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
              className="w-full bg-[#07090E] border border-slate-700 rounded-md px-3 py-2 text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(null)}
              className="px-4 py-2 text-xs text-slate-300 border border-slate-700 rounded-md hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-medium bg-cyan-500 text-slate-950 rounded-md hover:bg-cyan-400 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      )}

      {/* Split Layout: Roster List + Selected Profile Details & History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-3">
          {astronauts.map((astro) => {
            const isSelected = activeId === astro.id;
            return (
              <div
                key={astro.id}
                onClick={() => onSelectAstronaut(astro.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelectAstronaut(astro.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-colors flex items-center gap-4 ${
                  isSelected
                    ? 'bg-[#111827] border-cyan-500/50'
                    : 'bg-[#0D111A] border-slate-800/90 hover:border-slate-700'
                }`}
              >
                <div className="w-12 h-12 rounded-md overflow-hidden bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center">
                  {astro.avatar_url ? (
                    <img
                      src={astro.avatar_url}
                      alt={astro.full_name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-slate-500" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-semibold text-slate-100 truncate">
                      {astro.full_name}
                    </span>
                    <span className={`text-[11px] font-mono shrink-0 ${astro.data_source === 'SYNTHETIC' ? 'text-amber-300' : 'text-cyan-300'}`}>
                      {astro.data_source}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 truncate">
                    {astro.call_sign} · {astro.role}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 mt-1">
                    {astro.mission_name} · Day {astro.mission_day}/{astro.mission_duration_days}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-7 bg-[#0D111A] border border-slate-800/90 rounded-lg p-5">
          {detail ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div>
                  <div className="text-xs font-mono text-amber-300">
                    {detail.profile.call_sign} · Source: {detail.profile.data_source}
                  </div>
                  <h3 className="font-display text-xl font-semibold text-slate-100 mt-1">
                    {detail.profile.full_name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {detail.profile.role} · Mission {detail.profile.mission_name}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(detail.profile)}
                    className="px-3 py-1.5 text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-md flex items-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(detail.profile.id)}
                    className="px-3 py-1.5 text-xs bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 rounded-md flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {confirmDeleteId === detail.profile.id && (
                <div className="p-4 bg-rose-950/30 border border-rose-800/70 rounded-md flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-rose-200">
                    Confirm deletion of {detail.profile.call_sign} and all linked local health records?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-3 py-1.5 bg-slate-800 text-slate-200 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(detail.profile.id)}
                      className="px-3 py-1.5 bg-rose-600 text-white rounded-md font-medium"
                    >
                      Confirm Delete
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Age Bracket</span>
                  <span className="font-mono text-slate-100 mt-0.5 block">{detail.profile.age_group}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Blood Reference</span>
                  <span className="font-mono text-slate-100 mt-0.5 block">{detail.profile.blood_type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Health Logs</span>
                  <span className="font-mono text-slate-100 mt-0.5 block tabular-nums">{detail.recent_health_count}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Last Modified</span>
                  <span className="font-mono text-slate-100 mt-0.5 block">{detail.profile.updated_at.slice(0, 10)}</span>
                </div>
              </div>

              <div className="text-xs">
                <span className="text-slate-400 block mb-1">Operational Notes</span>
                <p className="text-slate-300 leading-relaxed bg-[#07090E] border border-slate-800/80 rounded-md p-3">
                  {detail.profile.notes || 'No notes recorded.'}
                </p>
              </div>

              <div>
                <h4 className="font-display text-xs font-semibold text-slate-300 mb-2">
                  Profile Audit History
                </h4>
                <div className="divide-y divide-slate-800/80 max-h-48 overflow-y-auto text-xs">
                  {detail.history.map((h) => (
                    <div key={h.id} className="py-2 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-mono text-cyan-300">{h.field_changed}</span>
                        <span className="text-slate-400 ml-2">
                          {h.previous_value ? `${h.previous_value} -> ${h.new_value}` : h.new_value}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 shrink-0">
                        {h.change_source} · {h.changed_at.slice(0, 10)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-slate-400">
              Select an astronaut profile or create a new manual entry.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
