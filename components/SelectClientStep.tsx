import React, { useState, useMemo } from 'react';
import type { Client } from '../types';
import { PlusIcon, UsersIcon, RefreshIcon } from './icons';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';

interface SelectClientStepProps {
  clients: any[]; // raw Supabase rows
  onSelect: (client: Client) => void;
  onBack: () => void;
}

const SelectClientStep: React.FC<SelectClientStepProps> = ({
  clients: propClients,
  onSelect,
  onBack,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();
  const { createClient, branding } = useSettings();

  const isAdmin = user?.role === 'admin';

  // ✅ NORMALIZE DB ROWS → UI SHAPE
  const clients: Client[] = useMemo(() => {
    return (propClients || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      avatarUrl: c.avatar_url, // FIX
      source: 'square',        // FIX
      historicalData: [],      // Ensure required field from Client type is present
    }));
  }, [propClients]);

  const filteredClients = useMemo(() => {
    return clients.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clients, searchTerm]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      setCreateError('Name and email are required.');
      return;
    }
    setIsSubmitting(true);
    setCreateError(null);
    try {
      const newClient = await createClient({
        name: newName,
        email: newEmail,
      });
      onSelect(newClient);
    } catch (error: any) {
      if (
        error.message.includes('duplicate key value violates unique constraint')
      ) {
        setCreateError('A client with this email already exists.');
      } else {
        setCreateError('Failed to create client. Please try again.');
      }
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCreating) {
    return (
      <div className="flex flex-col h-full p-4 pb-12 bg-ds-surface">
        <div className="text-center p-4">
          <h1 className="text-2xl font-bold text-ds-text mb-1">
            Create New Client
          </h1>
          <p className="text-sm text-ds-text-muted">
            This client will be saved to your database.
          </p>
        </div>
        <form onSubmit={handleCreateClient} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1" className="text-ds-text-muted">
              Full Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              required
              className="w-full p-3 border border-ds-border rounded-lg outline-none focus:border-brand-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" className="text-ds-text-muted">
              Email Address
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              required
              className="w-full p-3 border border-ds-border rounded-lg outline-none focus:border-brand-accent"
            />
          </div>
          {createError && (
            <p className="text-red-500 text-sm font-bold">{createError}</p>
          )}
          <div className="pt-4 space-y-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full font-bold py-3 px-4 rounded-full shadow-lg transition-all active:scale-95"
              style={{
                backgroundColor: branding.secondaryColor,
                color: ensureAccessibleColor(
                  '#FFFFFF',
                  branding.secondaryColor,
                  '#1F2937'
                ),
              }}
            >
              {isSubmitting ? (
                <RefreshIcon className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Save and Continue'
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="w-full font-bold py-2"
              className="text-ds-text-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full pb-12">
      <div className="p-4 bg-ds-surface border-b border-ds-border">
        <h1 className="text-2xl font-bold text-center mb-2 tracking-tighter text-ds-text">
          Select Client
        </h1>
        <div className="relative">
          <input
            type="text"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full p-3 pl-10 bg-ds-bg border border-ds-border rounded-xl outline-none focus:bg-ds-surface focus:border-brand-accent transition-all text-ds-text"
          />
          <div className="absolute left-3 top-3.5" className="text-ds-text-muted">
            <UsersIcon className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-brand-bg">
        {isAdmin && (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full p-4 rounded-xl font-bold mb-4 shadow-md flex items-center justify-center active:scale-95 transition-all"
            style={{
              backgroundColor: branding.accentColor,
              color: ensureAccessibleColor(
                '#FFFFFF',
                branding.accentColor,
                '#1F2937'
              ),
            }}
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Create New Client
          </button>
        )}

        {filteredClients.length === 0 ? (
          <div className="text-center py-10">
            <p className="font-bold" className="text-ds-text-muted">No clients found.</p>
          </div>
        ) : (
          filteredClients.map(client => (
            <button
              key={client.id}
              onClick={() => onSelect(client)}
              className="w-full bg-ds-surface p-3 rounded-xl shadow-ds-1 border border-ds-border flex items-center hover:border-ds-border-strong transition-all active:scale-[0.98]"
            >
              <img
                src={client.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name)}&background=random`}
                alt={client.name}
                className="w-12 h-12 rounded-full mr-4 border border-ds-border"
              />
              <div className="flex-grow text-left">
                <h3 className="font-bold text-ds-text leading-tight">{client.name}</h3>
                <p className="text-[10px] font-black uppercase tracking-widest mt-0.5 text-ds-text-muted">
                  Source: {client.source}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-ds-bg flex items-center justify-center group-hover:bg-ds-surface-2 text-ds-text-muted">
                  <PlusIcon className="w-4 h-4" />
              </div>
            </button>
          ))
        )}
      </div>

      <div className="p-4 bg-ds-surface border-t border-ds-border">
        <button
          onClick={onBack}
          className="w-full bg-ds-surface-2 font-bold py-3 rounded-full hover:bg-ds-border transition-colors text-ds-text"
          className="text-ds-text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default SelectClientStep;
