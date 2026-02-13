import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';

import type {
  Service,
  StylistLevel,
  Stylist,
  Client,
  ServiceLinkingConfig,
  BrandingSettings,
  MembershipConfig,
  AppTextSize,
} from '../types';

import { ALL_SERVICES, STYLIST_LEVELS } from '../data/mockData';
import { supabase } from '../lib/supabase';
import { canCustomizeBranding } from '../utils/isEnterpriseAccount';
import { SquareIntegrationService } from '../services/squareIntegration';

// Blueprint default branding - uses Blueprint Design System v1.0.0 palette
export const BLUEPRINT_DEFAULT_BRANDING: BrandingSettings = {
  salonName: 'Blueprint',
  primaryColor: '#0B3559', /* Blueprint Navy */
  secondaryColor: '#42708C', /* Blueprint Steel */
  accentColor: '#5890A6', /* Blueprint Sky */
  font: 'Comfortaa',
  logoUrl: 'https://cdn.builder.io/api/v1/image/assets%2F8d6a989189ff4d9e8633804d5d0dbd86%2Fa72b6d70b1bc42b2991e3c072f2b3588?format=webp&width=800&height=1200',
};

type IntegrationProvider = 'square' | 'vagaro' | 'mindbody';
type IntegrationEnvironment = 'sandbox' | 'production';

export interface IntegrationSettings {
  provider: IntegrationProvider;
  environment: IntegrationEnvironment;
}

interface SettingsContextType {
  services: Service[];
  levels: StylistLevel[];
  stylists: Stylist[];
  clients: Client[];

  membershipConfig: MembershipConfig;
  branding: BrandingSettings;
  integration: IntegrationSettings;
  linkingConfig: ServiceLinkingConfig;
  textSize: AppTextSize;
  pushAlertsEnabled: boolean;
  pinnedReports: { [userId: string]: string[] };

  loadingTeam: boolean;
  teamError: string | null;
  needsSquareConnect: boolean;

  updateServices: (services: Service[]) => void;
  updateLevels: (levels: StylistLevel[]) => void;
  updateStylists: (stylists: Stylist[]) => void;
  updateClients: (clients: Client[]) => void;

  updateMembershipConfig: React.Dispatch<React.SetStateAction<MembershipConfig>>;
  updateBranding: (branding: BrandingSettings) => void;
  updateIntegration: (integration: IntegrationSettings) => void;
  updateLinkingConfig: (config: ServiceLinkingConfig) => void;

  updateTextSize: (size: AppTextSize) => void;
  updatePushAlertsEnabled: (enabled: boolean) => void;
  updatePinnedReports: (userId: string | number, reportIds: string[]) => void;

  cancellationPolicy: string;
  updateCancellationPolicy: (policy: string) => void;

  createClient: (clientData: { name: string; email: string }) => Promise<Client>;
  resolveClientByExternalId: (
    externalId: string,
    clientDetails: { name: string; email?: string; phone?: string; avatarUrl?: string }
  ) => Promise<Client>;

  saveAll: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Core settings state (single instance)
  const [services, setServices] = useState<Service[]>(() => ALL_SERVICES);
  const [levels, setLevels] = useState<StylistLevel[]>(() => STYLIST_LEVELS);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const fallbackPermissions = useMemo(
    () => ({
      canBookAppointments: true,
      canOfferDiscounts: false,
      requiresDiscountApproval: true,
      viewGlobalReports: false,
      viewClientContact: true,
      viewAllSalonPlans: false,
      can_book_own_schedule: true,
      can_book_peer_schedules: false,
    }),
    []
  );

  const resolveLevelDefaults = (levelId: string | null | undefined) => {
    const level = levels.find((item) => item.id === levelId);
    return level?.defaultPermissions || fallbackPermissions;
  };

  const [membershipConfig, setMembershipConfig] = useState<MembershipConfig>({
    enabled: true,
    tiers: [],
  });

  const [branding, setBranding] = useState<BrandingSettings>(BLUEPRINT_DEFAULT_BRANDING);

  const [integration, setIntegration] = useState<IntegrationSettings>({
    provider: 'square',
    environment: 'production',
  });

  const [linkingConfig, setLinkingConfig] = useState<ServiceLinkingConfig>({
    enabled: true,
    triggerCategory: 'Color',
    triggerServiceIds: [],
    exclusionServiceId: '',
    linkedServiceId: '',
  });

  const [textSize, setTextSize] = useState<AppTextSize>('M');
  const [pushAlertsEnabled, setPushAlertsEnabled] = useState(false);
  const [pinnedReports, setPinnedReports] = useState<{ [userId: string]: string[] }>({});

  const [cancellationPolicy, setCancellationPolicy] = useState('');

  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [needsSquareConnect, setNeedsSquareConnect] = useState<boolean>(false);

  // Load data once per auth session; no loops, no state that triggers re-subscribe.
  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;
    let isLoading = false;
    let lastLoadedUserId: string | null = null;

    const loadForUser = async (passedUser?: any) => {
      // Prevent duplicate runs for the same user
      if (passedUser?.id && passedUser.id === lastLoadedUserId) {
        console.log('[Settings] loadForUser skipped (already loaded for user:', passedUser.id, ')');
        return;
      }
      if (isLoading) {
        console.log('[Settings] loadForUser skipped (already loading)');
        return;
      }
      isLoading = true;
      console.log('[Settings] loadForUser called, passedUser:', passedUser?.id || 'none');

      let user = passedUser;

      // If no user passed directly, try to get from session
      if (!user) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (cancelled) return;
        user = sessionData?.session?.user;
      }

      if (!user) {
        console.log('[Settings] No authenticated user, skipping data load');
        setNeedsSquareConnect(false);
        return;
      }

      console.log('[Settings] Authenticated user:', user.id, user.email, 'metadata:', JSON.stringify(user.user_metadata));

      // --- Check Square Connection Status (informational only) ---
      const { data: merchantSettings, error: msError } = await supabase
        .from('merchant_settings')
        .select('square_access_token')
        .eq('supabase_user_id', user.id)
        .maybeSingle();

      console.log('[Settings] merchant_settings query:', {
        found: !!merchantSettings,
        hasToken: !!merchantSettings?.square_access_token,
        error: msError?.message || null,
      });

      if (cancelled) return;

      const hasSquareFromDb = !!merchantSettings?.square_access_token;
      const hasSquareFromMeta = !!user.user_metadata?.merchant_id;

      if (msError && !hasSquareFromMeta) {
        setNeedsSquareConnect(true);
      } else if (!hasSquareFromDb && !hasSquareFromMeta) {
        setNeedsSquareConnect(true);
      } else {
        setNeedsSquareConnect(false);
      }

      // ---- ALWAYS try to fetch from Square API ----
      // The proxy resolves the Square token server-side from merchant_settings.
      // We don't need the token client-side. Just try and catch errors gracefully.

      // ---- Services ----
      console.log('[Settings] Fetching services from Square catalog...');
      try {
        const squareServices = await SquareIntegrationService.fetchCatalog();
        if (cancelled) return;
        if (squareServices.length > 0) {
          console.log('[Settings] ✅ Loaded', squareServices.length, 'services from Square');
          setServices(squareServices);
        } else {
          console.log('[Settings] Square returned 0 services, keeping defaults');
        }
      } catch (e) {
        if (!cancelled) {
          console.warn('[Settings] ⚠️ Failed to fetch Square catalog:', e);
        }
      }

      if (cancelled) return;

      // ---- Clients ----
      const userRole = user.user_metadata?.role || 'admin';
      let merchantId = user.user_metadata?.merchant_id;
      const stylistSquareId = user.user_metadata?.stylist_id;

      // Fallback: if stylist has no merchant_id in metadata, look it up from square_team_members
      if (userRole === 'stylist' && !merchantId && stylistSquareId) {
        try {
          const { data: tmRow } = await supabase
            .from('square_team_members')
            .select('merchant_id')
            .eq('square_team_member_id', stylistSquareId)
            .maybeSingle();
          if (tmRow?.merchant_id) {
            merchantId = tmRow.merchant_id;
            console.log('[Settings] Resolved merchant_id from square_team_members:', merchantId);
          }
        } catch (e) {
          console.warn('[Settings] Failed to resolve merchant_id from square_team_members:', e);
        }
      }

      if (userRole === 'stylist' && merchantId) {
        // Stylist: load clients from the admin who owns this merchant
        console.log('[Settings] Stylist detected, loading clients for merchant:', merchantId);
        try {
          // Find the admin's user ID from merchant_settings
          const { data: ms } = await supabase
            .from('merchant_settings')
            .select('supabase_user_id')
            .eq('square_merchant_id', merchantId)
            .maybeSingle();

          const adminUserId = ms?.supabase_user_id;
          const userIdsToQuery = adminUserId ? [adminUserId, user.id] : [user.id];

          const { data } = await supabase
            .from('clients')
            .select('*')
            .in('supabase_user_id', userIdsToQuery)
            .order('created_at', { ascending: true });

          if (cancelled) return;
          if (data && data.length > 0) {
            console.log('[Settings] ✅ Loaded', data.length, 'clients for stylist (admin + own)');
            setClients(data.map((row: any) => ({
              id: row.id,
              externalId: row.external_id,
              name: row.name,
              email: row.email,
              phone: row.phone,
              avatarUrl: row.avatar_url,
              historicalData: [],
              source: row.source || 'manual',
            })));
          } else {
            console.log('[Settings] No clients found for stylist');
          }
        } catch (e) {
          if (!cancelled) console.warn('[Settings] ⚠️ Failed to load clients for stylist:', e);
        }
      } else {
        // Admin: try Square first, then Supabase fallback
        console.log('[Settings] Fetching clients from Square...');
        try {
          const squareClients = await SquareIntegrationService.fetchCustomers();
          if (cancelled) return;
          if (squareClients.length > 0) {
            console.log('[Settings] ✅ Loaded', squareClients.length, 'clients from Square');
            const mapped: Client[] = squareClients.map((c: any) => ({
              id: c.id || c.externalId,
              externalId: c.externalId || c.id,
              name: c.name || 'Client',
              email: c.email,
              phone: c.phone,
              avatarUrl: c.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || 'C')}&background=random`,
              historicalData: [],
              source: 'square',
            }));
            setClients(mapped);
          } else {
            console.log('[Settings] Square returned 0 clients');
          }
        } catch (e) {
          if (!cancelled) {
            console.warn('[Settings] ⚠️ Failed to fetch Square clients:', e);
            // Fallback: try Supabase
            try {
              const { data } = await supabase
                .from('clients')
                .select('*')
                .eq('supabase_user_id', user.id)
                .order('created_at', { ascending: true });
              if (data && data.length > 0) {
                console.log('[Settings] Loaded', data.length, 'clients from Supabase fallback');
                setClients(data.map((row: any) => ({
                  id: row.id,
                  externalId: row.external_id,
                  name: row.name,
                  email: row.email,
                  phone: row.phone,
                  avatarUrl: row.avatar_url,
                  historicalData: [],
                  source: row.source || 'manual',
                })));
              }
            } catch (sbErr) {
              console.warn('[Settings] Supabase client fallback also failed:', sbErr);
            }
          }
        }
      }

      if (cancelled) return;

      // ---- Team ----
      setLoadingTeam(true);
      setTeamError(null);
      console.log('[Settings] Fetching team from Square...');
      try {
        const squareTeam = await SquareIntegrationService.fetchTeam();
        if (cancelled) return;
        if (squareTeam.length > 0) {
          console.log('[Settings] ✅ Loaded', squareTeam.length, 'team members from Square');
          setStylists(squareTeam);
        } else {
          console.log('[Settings] Square returned 0 team members');
          // Fallback: try Supabase
          const { data } = await supabase
            .from('square_team_members')
            .select('*')
            .eq('supabase_user_id', user.id);
          if (data && data.length > 0) {
            console.log('[Settings] Loaded', data.length, 'team members from Supabase fallback');
            setStylists(data.map((row: any) => {
              const levelId = row.level_id || levels[0]?.id || 'lvl_1';
              const permissionOverrides = row.permission_overrides || row.permissions || {};
              const levelDefaults = resolveLevelDefaults(levelId);
              const permissions = { ...levelDefaults, ...permissionOverrides };
              return {
                id: row.square_team_member_id,
                name: row.name,
                role: row.role || 'Team Member',
                email: row.email,
                levelId,
                permissions,
                permissionOverrides,
              };
            }));
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          console.warn('[Settings] ⚠️ Failed to fetch Square team:', e);
          setTeamError(e?.message || 'Failed to load team');
        }
      } finally {
        if (!cancelled) setLoadingTeam(false);
        isLoading = false;
        if (user?.id) lastLoadedUserId = user.id;
        console.log('[Settings] loadForUser completed for user:', user?.id);
      }
    };

    // Run once immediately
    void loadForUser();

    // Subscribe once to auth changes
    // FIX: Cast to 'any' to bypass Supabase auth method type errors, likely from an environment configuration issue.
    const { data } = (supabase.auth as any).onAuthStateChange((event: string, session: any) => {
      console.log('[Settings] onAuthStateChange:', event, 'user:', session?.user?.id || 'none');
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        // Pass the user directly from the session — avoids needing getSession()/getUser() network calls
        void loadForUser(session?.user);
      }
      if (event === 'SIGNED_OUT') {
        // Clear user-scoped data
        setClients([]);
        setStylists([]);
        setLoadingTeam(false);
        setTeamError(null);
        setNeedsSquareConnect(false);
      }
    });

    return () => {
      cancelled = true;
      data?.subscription?.unsubscribe();
    };
  }, []);

  // Apply text size to html root so all rem units scale
  useEffect(() => {
    const sizes: Record<string, string> = { S: '13px', M: '16px', L: '20px' };
    document.documentElement.style.fontSize = sizes[textSize] || '16px';
  }, [textSize]);

  // Normalize existing membership config data on mount
  useEffect(() => {
    if (membershipConfig.tiers.length > 0) {
      const hasInvalidMinSpend = membershipConfig.tiers.some(tier => typeof tier.minSpend !== 'number' || isNaN(Number(tier.minSpend)));
      if (hasInvalidMinSpend) {
        console.log('[Settings] Normalizing membership config minSpend values');
        updateMembershipConfig(prev => ({
          ...prev,
          tiers: prev.tiers.map(tier => ({
            ...tier,
            minSpend: Number(tier.minSpend) || 0
          }))
        }));
      }
    }
  }, []); // Run only once on mount

  // Updaters
  const updateServices = (v: Service[]) => setServices(v);
  const updateLevels = (v: StylistLevel[]) => setLevels(v);
  const updateStylists = (v: Stylist[]) => setStylists(v);
  const updateClients = (v: Client[]) => setClients(v);

  const updateMembershipConfig = React.useCallback<React.Dispatch<React.SetStateAction<MembershipConfig>>>(
    (config) => {
      setMembershipConfig((prev) => {
        const newConfig = typeof config === 'function' ? config(prev) : config;
        // Ensure all minSpend values are numbers
        const normalizedConfig = {
          ...newConfig,
          tiers: newConfig.tiers.map(tier => ({
            ...tier,
            minSpend: Number(tier.minSpend) || 0
          }))
        };
        return normalizedConfig;
      });
    },
    []
  );

  const updateBranding = (v: BrandingSettings) => setBranding(v);
  const updateIntegration = (v: IntegrationSettings) => setIntegration(v);
  const updateLinkingConfig = (v: ServiceLinkingConfig) => setLinkingConfig(v);

  const updateTextSize = (size: AppTextSize) => setTextSize(size);
  const updatePushAlertsEnabled = (enabled: boolean) => setPushAlertsEnabled(enabled);

  const updatePinnedReports = (userId: string | number, reportIds: string[]) => {
    setPinnedReports((prev) => ({ ...prev, [String(userId)]: reportIds }));
  };

  // Minimal createClient (manual clients only). Keeps API surface intact.
  const createClient = async (clientData: { name: string; email: string }) => {
    if (!supabase) throw new Error('Supabase not initialized');

    // FIX: Cast to 'any' to bypass Supabase auth method type errors, likely from an environment configuration issue.
    const { data: userResp, error: userErr } = await (supabase.auth as any).getUser();
    const user = userResp?.user;
    if (userErr || !user) throw new Error('Not authenticated');

    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      clientData.name
    )}&background=random`;

    const { data, error } = await supabase
      .from('clients')
      .insert(
        {
          supabase_user_id: user.id,
          name: clientData.name,
          email: clientData.email,
          avatar_url: avatarUrl,
          source: 'manual',
        } as any
      )
      .select()
      .single();

    if (error || !data) throw error || new Error('Failed to create client');

    const row = data as any;
    const newClient: Client = {
      id: row.id,
      externalId: row.external_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      avatarUrl: row.avatar_url,
      historicalData: [],
      source: row.source || 'manual',
    };

    setClients((prev) => [...prev, newClient]);
    return newClient;
  };

  // Minimal resolver that ensures a client exists in DB (used by downstream flows)
  const resolveClientByExternalId = async (
    externalId: string,
    clientDetails: { name: string; email?: string; phone?: string; avatarUrl?: string }
  ): Promise<Client> => {
    if (!supabase) throw new Error('Supabase not initialized');

    // FIX: Cast to 'any' to bypass Supabase auth method type errors, likely from an environment configuration issue.
    const { data: userResp, error: userErr } = await (supabase.auth as any).getUser();
    const user = userResp?.user;
    if (userErr || !user) throw new Error('Not authenticated');

    const local = clients.find((c) => c.externalId === externalId);
    if (local) return local;

    const { data: existing, error: findErr } = await supabase
      .from('clients')
      .select('*')
      .eq('supabase_user_id', user.id)
      .eq('external_id', externalId)
      .maybeSingle();

    if (findErr) console.error('[Settings] resolveClient find error:', findErr);

    if (existing) {
      const row = existing as any;
      const client: Client = {
        id: row.id,
        externalId: row.external_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        avatarUrl: row.avatar_url,
        historicalData: [],
        source: row.source || 'square',
      };
      setClients((prev) => [...prev.filter((c) => c.id !== client.id), client]);
      return client;
    }

    const avatarUrl =
      clientDetails.avatarUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        clientDetails.name
      )}&background=random`;

    const { data, error } = await supabase
      .from('clients')
      .insert(
        {
          supabase_user_id: user.id,
          external_id: externalId,
          name: clientDetails.name,
          email: clientDetails.email || null,
          phone: clientDetails.phone || null,
          avatar_url: avatarUrl,
          source: 'square',
        } as any
      )
      .select()
      .single();

    if (error || !data) throw error || new Error('Failed to create client');

    const row = data as any;
    const newClient: Client = {
      id: row.id,
      externalId: row.external_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      avatarUrl: row.avatar_url,
      historicalData: [],
      source: row.source || 'square',
    };

    setClients((prev) => [...prev, newClient]);
    return newClient;
  };

  // Keep settings save non-blocking for now; persistence will be implemented once app is stable.
  const saveAll = async () => {
    try {
      localStorage.setItem('admin_services', JSON.stringify(services));
      localStorage.setItem('admin_levels', JSON.stringify(levels));
      localStorage.setItem('admin_membership_config', JSON.stringify(membershipConfig));
      localStorage.setItem('admin_integration', JSON.stringify(integration));
      localStorage.setItem('admin_branding', JSON.stringify(branding));
      localStorage.setItem('admin_linking_config', JSON.stringify(linkingConfig));
      localStorage.setItem('admin_text_size', String(textSize));
      localStorage.setItem('admin_push_alerts_enabled', String(pushAlertsEnabled));
      localStorage.setItem('admin_pinned_reports', JSON.stringify(pinnedReports));
    } catch (e) {
      console.error('[Settings] Failed to save locally:', e);
    }
  };

  const value = useMemo<SettingsContextType>(
    () => ({
      services,
      levels,
      stylists,
      clients,
      membershipConfig,
      branding,
      integration,
      linkingConfig,
      textSize,
      pushAlertsEnabled,
      pinnedReports,
      loadingTeam,
      teamError,
      needsSquareConnect,
      updateServices,
      updateLevels,
      updateStylists,
      updateClients,
      updateMembershipConfig,
      updateBranding,
      updateIntegration,
      updateLinkingConfig,
      updateTextSize,
      updatePushAlertsEnabled,
      updatePinnedReports,
      cancellationPolicy,
      updateCancellationPolicy: setCancellationPolicy,
      createClient,
      resolveClientByExternalId,
      saveAll,
    }),
    [
      services,
      levels,
      stylists,
      clients,
      membershipConfig,
      branding,
      integration,
      linkingConfig,
      textSize,
      pushAlertsEnabled,
      pinnedReports,
      cancellationPolicy,
      loadingTeam,
      teamError,
      needsSquareConnect,
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
