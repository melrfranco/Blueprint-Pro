import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { GeneratedPlan, UserRole, Service, PlanAppointment } from '../types';
import { SERVICE_COLORS } from '../data/mockData';
import { useSettings } from '../contexts/SettingsContext';
import { usePlans } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';
import { SquareIntegrationService } from '../services/squareIntegration';
import { CheckCircleIcon, CalendarIcon, RefreshIcon, GlobeIcon, PlusIcon, ChevronRightIcon, ChevronLeftIcon, ShareIcon, DocumentTextIcon } from './icons';


interface PlanSummaryStepProps {
  plan: GeneratedPlan;
  role: UserRole;
  onEditPlan?: () => void;
}

type BookingStep = 'select-visit' | 'select-date' | 'select-period' | 'select-slot' | 'confirm';
type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'all';
type DeliveryMethod = 'sms' | 'email' | 'link';

const PlanSummaryStep: React.FC<PlanSummaryStepProps> = ({ plan, role, onEditPlan }) => {
  // Log plan details for debugging
  console.log('[PLAN SUMMARY] Plan loaded:', {
    clientName: plan.client.name,
    appointmentCount: plan.appointments.length,
    services: plan.appointments[0]?.services.map(s => ({ name: s.name, id: s.id })) || []
  });

  const [isMembershipModalOpen, setMembershipModalOpen] = useState(false);
  const [isBookingModalOpen, setBookingModalOpen] = useState(false);
  
  const [bookingStep, setBookingStep] = useState<BookingStep>('select-visit');
  const [selectedVisit, setSelectedVisit] = useState<PlanAppointment | null>(null);
  const [bookingDate, setBookingDate] = useState<Date | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [isPublishing, setIsPublishing] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('sms');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isViewingMembershipDetails, setIsViewingMembershipDetails] = useState(false);
  const [selectedChartVisit, setSelectedChartVisit] = useState<PlanAppointment | null>(null);
  const [selectedSlotTime, setSelectedSlotTime] = useState<string | null>(null);
  
  const { membershipConfig, integration, services: allServices, stylists: allStylists, cancellationPolicy } = useSettings();
  const { savePlan, saveBooking } = usePlans();
  const { user } = useAuth();

  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const isPlanActive = plan.status === 'active';
  const isMemberOffered = plan.membershipStatus === 'offered';
  const isMemberActive = plan.membershipStatus === 'active';

  const isClient = user?.role === 'client';
  const canBook = user?.role === 'admin' || isClient;
  const canViewClientContact = user?.role === 'admin' || isClient;
  const isContactRestricted = !isClient && !canViewClientContact;

  const projectedMonthlySpend = useMemo(() => plan.totalCost / 12, [plan.totalCost]);

  const qualifyingTier = useMemo(() => {
      if (!membershipConfig?.tiers || membershipConfig.tiers.length === 0) return undefined;
      const sortedTiers = [...membershipConfig.tiers].sort((a, b) => b.minSpend - a.minSpend);
      return sortedTiers.find(t => projectedMonthlySpend >= t.minSpend) || sortedTiers[sortedTiers.length - 1];
  }, [projectedMonthlySpend, membershipConfig?.tiers]);

  const serviceSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    plan.appointments.forEach(appt => {
      appt.services.forEach(s => {
        counts[s.name] = (counts[s.name] || 0) + 1;
      });
    });
    return counts;
  }, [plan.appointments]);

  const membershipDates = useMemo(() => {
    if (plan.appointments.length === 0) return { start: '', end: '' };
    const sorted = [...plan.appointments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const start = new Date(sorted[0].date);
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    return {
      start: start.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }),
      end: end.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }),
    };
  }, [plan.appointments]);

  const invitationMessage = useMemo(() => {
    if (!qualifyingTier || !plan.client.name) return '';
    const firstName = plan.client.name.split(' ')[0];
    const serviceLines = Object.entries(serviceSummary)
      .map(([name, count]) => `  - ${name}: ${count}x per year`)
      .join('\n');
    const perkLines = qualifyingTier.perks?.length
      ? qualifyingTier.perks.map(p => `  - ${p}`).join('\n')
      : '  - Exclusive member benefits';

    return `Hi ${firstName}! Based on your maintenance blueprint, you qualify for our ${qualifyingTier.name} membership.\n\nMonthly Cost: ${formatCurrency(projectedMonthlySpend)}/mo\n\nIncluded Services (12-month plan):\n${serviceLines}\n\nMembership Period:\n  ${membershipDates.start} — ${membershipDates.end}\n\nPerks:\n${perkLines}\n\nCheck out your full roadmap here: [Link]`;
  }, [plan, qualifyingTier, serviceSummary, membershipDates, projectedMonthlySpend]);

  const futureVisits = useMemo(() => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      return plan.appointments.filter(a => {
          const apptDate = new Date(a.date);
          return apptDate.getTime() > today.getTime();
      });
  }, [plan.appointments]);

  const visitChartData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pastAppts = plan.appointments.filter(a => new Date(a.date) < today);
    const futureAppts = plan.appointments.filter(a => new Date(a.date) >= today);
    const recentPast = pastAppts.slice(-2);
    const visibleAppts = [...recentPast, ...futureAppts].slice(0, 17);

    return visibleAppts.map((appt, index) => {
        const apptDate = new Date(appt.date);
        const isPast = apptDate < today;
        const dataPoint: any = {
            name: appt.date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            fullDate: appt.date.toLocaleDateString([], { dateStyle: 'long' }),
            index: index + 1,
            isPast,
            _appointment: appt,
        };
        appt.services.forEach(s => {
            dataPoint[s.name] = (dataPoint[s.name] || 0) + s.cost;
        });
        return dataPoint;
    });
  }, [plan]);

  const serviceLegend = useMemo(() => Array.from(new Set(plan.appointments.flatMap(a => a.services.map(s => s.name)))), [plan.appointments]);
  
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
        const updated = await savePlan({ ...plan, status: 'active' });
        if (onEditPlan) {
          onEditPlan();
        }
    } catch (e) {
        console.error("Publishing failed:", e);
    } finally {
        setIsPublishing(false);
    }
  };

  const handleSendInvite = async () => {
    if (!canViewClientContact && !isClient) {
      return;
    }

    setIsSendingInvite(true);

    const message = invitationMessage;
    const clientPhone = plan.client.phone || '';
    const clientEmail = plan.client.email || '';

    try {
        if (deliveryMethod === 'sms') {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            const separator = isIOS ? '&' : '?';
            const cleanPhone = clientPhone.replace(/\D/g, '');
            window.location.href = `sms:${cleanPhone}${separator}body=${encodeURIComponent(message)}`;
        } else if (deliveryMethod === 'email') {
            window.location.href = `mailto:${clientEmail}?subject=${encodeURIComponent("Your Salon Roadmap & Membership Invitation")}&body=${encodeURIComponent(message)}`;
        } else if (deliveryMethod === 'link') {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(message);
            }
        }

        await savePlan({ ...plan, membershipStatus: 'offered', membershipOfferSentAt: new Date().toISOString() });
        setInviteSent(true);
        setTimeout(() => {
          setMembershipModalOpen(false);
          setInviteSent(false);
        }, 1500);
    } catch (e) {
        console.error("Failed to send invite or save status", e);
    } finally {
        setIsSendingInvite(false);
    }
  };

  const handleAcceptMembership = async () => {
    setIsAccepting(true);
    try {
        await savePlan({ ...plan, membershipStatus: 'active', membershipOfferAcceptedAt: new Date().toISOString() });
        setIsViewingMembershipDetails(false);
    } catch(e) {
        console.error("Failed to accept membership:", e);
    } finally {
        setIsAccepting(false);
    }
  };

  const handleOpenBooking = () => {
      if (!canBook) return;
      setBookingModalOpen(true);
      setBookingStep('select-visit');
      setBookingSuccess(false);
      setFetchError(null);
  };
  
  const fetchAvailabilityForCalendar = async (visit: PlanAppointment) => {
    setIsFetchingSlots(true);
    setFetchError(null);
    try {
        if (!visit) throw new Error("No visit selected.");

        const loc = await SquareIntegrationService.fetchLocation();

        let stylistId = isClient ? plan.stylistId : (user?.stylistData?.id || allStylists[0]?.id);

        if (stylistId && !String(stylistId).startsWith('TM')) {
            console.log('[BOOKING CALENDAR] Stylist ID is not a Square Team Member ID, finding valid one:', stylistId);
            const validStylist = allStylists.find(s => String(s.id).startsWith('TM'));
            if (validStylist) {
                stylistId = validStylist.id;
                console.log('[BOOKING CALENDAR] Resolved to valid Square Team Member:', stylistId);
            }
        }

        console.log('[BOOKING CALENDAR] Stylist lookup:', {
            isClient,
            planStylistId: plan.stylistId,
            userStylistDataId: user?.stylistData?.id,
            allStylists: allStylists.map(s => ({ id: s.id, name: s.name })),
            resolvedId: stylistId
        });
        if (!stylistId) throw new Error("No team member selected or found.");

        const serviceToBook = visit.services[0];
        if (!serviceToBook) {
            throw new Error(`No service selected for this visit.`);
        }

        console.log('[BOOKING] Service from plan (full object):', serviceToBook);

        if (!serviceToBook.name) {
            console.error('[BOOKING] Service missing name:', serviceToBook);
            throw new Error(`Service is missing name property: ${JSON.stringify(serviceToBook)}. This plan may be corrupted. Please regenerate the plan.`);
        }

        console.log('[BOOKING] Service from plan:', { name: serviceToBook.name, id: serviceToBook.id });

        const squareCatalog = await SquareIntegrationService.fetchCatalog();
        console.log('[BOOKING] Catalog has', squareCatalog.length, 'services');
        console.log('[BOOKING] Catalog service IDs:', squareCatalog.map(s => s.id));

        let serviceVariationId = serviceToBook.id;

        const existingService = squareCatalog.find(s => s.id === serviceVariationId);
        console.log('[BOOKING] Looking for service ID', serviceVariationId, '- found:', !!existingService);

        if (!existingService) {
            console.log('[BOOKING] Trying to find by name:', serviceToBook.name);
            let squareService = squareCatalog.find(s => s.name === serviceToBook.name);

            if (!squareService) {
                const searchName = serviceToBook.name.toLowerCase();
                squareService = squareCatalog.find(s => s.name.toLowerCase() === searchName);
                if (squareService) {
                    console.log('[BOOKING] Found by case-insensitive name match:', serviceToBook.name, '->', squareService.name);
                }
            }

            console.log('[BOOKING] Found by name:', !!squareService);
            if (!squareService || !squareService.id) {
                const availableServices = squareCatalog.map(s => s.name).join(', ');
                throw new Error(`Service "${serviceToBook.name}" not found in your Square catalog. Available: ${availableServices}`);
            }
            serviceVariationId = squareService.id;
            console.log('[BOOKING] Mapped service to Square by name:', { name: serviceToBook.name, plannedId: serviceToBook.id, squareId: serviceVariationId });
        }

        const searchStart = new Date(visit.date);
        const now = new Date();
        now.setHours(0,0,0,0);
        if (searchStart < now) searchStart.setTime(now.getTime());

        const slots = await SquareIntegrationService.findAvailableSlots({
            locationId: loc.id,
            startAt: SquareIntegrationService.formatDate(searchStart, loc.timezone),
            teamMemberId: stylistId,
            serviceVariationId: serviceVariationId
        });

        const dates = new Set<string>();
        slots.forEach(s => {
            const d = new Date(s);
            dates.add(d.toISOString().split('T')[0]);
        });
        setAvailableDates(dates);
    } catch (e: any) { 
        setFetchError(e.message); 
    } finally { 
        setIsFetchingSlots(false); 
    }
  };

  const handleVisitSelected = (visit: PlanAppointment) => {
    setSelectedVisit(visit);
    setBookingDate(visit.date);
    setCalendarMonth(visit.date);
    fetchAvailabilityForCalendar(visit);
    setBookingStep('select-date');
  };

  const confirmPeriodAndFetch = (period: TimePeriod) => {
    setTimePeriod(period);
    setBookingStep('select-slot');
  };

  const availablePeriods = useMemo(() => {
      const periods = { morning: false, afternoon: false, evening: false };
      availableSlots.forEach(s => {
          const hour = new Date(s).getHours();
          if (hour < 12) periods.morning = true;
          else if (hour < 17) periods.afternoon = true;
          else periods.evening = true;
      });
      return periods;
  }, [availableSlots]);

  const filteredSlots = useMemo(() => {
      return availableSlots.filter(s => {
          const hour = new Date(s).getHours();
          if (timePeriod === 'morning') return hour < 12;
          if (timePeriod === 'afternoon') return hour >= 12 && hour < 17;
          if (timePeriod === 'evening') return hour >= 17;
          return true;
      });
  }, [availableSlots, timePeriod]);

  const groupedSlots = useMemo(() => {
      const groups: { [key: string]: string[] } = {};
      filteredSlots.forEach(s => {
          const day = new Date(s).toDateString();
          if (!groups[day]) groups[day] = [];
          groups[day].push(s);
      });
      return groups;
  }, [filteredSlots]);

  const executeBooking = async (slotTime: string) => {
      setIsBooking(true);
      setFetchError(null);
      try {
          const mockServices = selectedVisit!.services;
          if (!mockServices || mockServices.length === 0) {
              throw new Error("No services were selected for this visit.");
          }

          const squareCatalog = await SquareIntegrationService.fetchCatalog();

          const squareServices = mockServices.map(ms => {
              const existing = squareCatalog.find(s => s.id === ms.id);
              if (existing) {
                  return existing;
              }
              let found = squareCatalog.find(s => s.name === ms.name);

              if (!found) {
                  const searchName = ms.name.toLowerCase();
                  found = squareCatalog.find(s => s.name.toLowerCase() === searchName);
              }

              if (!found) {
                  throw new Error(`Service "${ms.name}" not found in your Square catalog.`);
              }
              return found;
          });

          let stylistIdToBookFor = isClient ? plan.stylistId : (user?.stylistData?.id || allStylists[0]?.id);

          if (stylistIdToBookFor && !String(stylistIdToBookFor).startsWith('TM')) {
              const validStylist = allStylists.find(s => String(s.id).startsWith('TM'));
              if (validStylist) {
                  stylistIdToBookFor = validStylist.id;
              }
          }

          const loc = await SquareIntegrationService.fetchLocation();

          let customerId = plan.client.externalId || await SquareIntegrationService.searchCustomer(plan.client.name);
          if (!customerId) throw new Error(`Could not find client "${plan.client.name}" in Square.`);

          const squareResponse = await SquareIntegrationService.createAppointment({
              locationId: loc.id,
              startAt: slotTime,
              customerId,
              teamMemberId: stylistIdToBookFor,
              services: squareServices
          });

          const squareBooking = squareResponse.booking;
          if (squareBooking) {
              await saveBooking({
                  planId: plan.id!,
                  squareBookingId: squareBooking.id,
                  startAt: squareBooking.startAt,
                  status: squareBooking.status || 'ACCEPTED',
                  services: selectedVisit!.services.map(s => s.name),
              });
          }

          setBookingSuccess(true);
      } catch (e: any) {
          setFetchError(e.message);
      } finally {
          setIsBooking(false);
      }
  };

  const isMissingContact = (deliveryMethod === 'sms' && !plan.client.phone) || (deliveryMethod === 'email' && !plan.client.email);


  const month = calendarMonth.getMonth();
  const year = calendarMonth.getFullYear();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarBlanks = Array(firstDayOfMonth).fill(null);
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className="flex-grow p-4 overflow-y-auto text-foreground">
        <div className="mb-6 flex justify-between items-end border-b pb-4 border-border">
            <div>
                <h1 className="bp-page-title leading-none mb-1">Blueprint Summary</h1>
                <p className="bp-subtitle pl-4">{plan.client.name}</p>
            </div>
            <span className={`bp-overline px-4 py-1.5 bp-container-compact border-2 shadow-sm ${isPlanActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-foreground border-foreground/40'}`}>
                {isPlanActive ? 'PUBLISHED' : 'DRAFT'}
            </span>
        </div>

        {membershipConfig.enabled && isClient && isMemberOffered && (
            <div className="mb-6 p-6 bp-container-tall shadow-xl animate-fade-in border-4 bg-card border-primary">
                <h2 className="bp-section-title mb-4 text-primary">Membership Invitation</h2>
                <p className="bp-body-sm mb-4 leading-relaxed text-muted-foreground">
                    Your blueprint qualifies for a membership! Review the details to enjoy a more predictable and streamlined salon experience.
                </p>
                <button
                    onClick={() => setIsViewingMembershipDetails(true)}
                    className="w-full font-bold py-4 bp-container-compact shadow-lg flex items-center justify-center space-x-3 active:scale-95 transition-all border-b-4 border-black/20 bg-primary text-primary-foreground"
                >
                    See Membership Details
                </button>
            </div>
        )}

        {membershipConfig.enabled && isClient && isMemberActive && (
             <div className="mb-6 p-6 bp-container-tall shadow-lg animate-fade-in border-4 border-accent bg-accent/10 text-center">
                <CheckCircleIcon className="w-10 h-10 text-accent mx-auto mb-3" />
                <h2 className="bp-card-title text-foreground">{"You're enrolled! This blueprint is now your active membership."}</h2>
            </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="col-span-2 p-6 px-8 bp-container-list text-primary-foreground shadow-sm flex justify-between items-center bg-primary">
                <div>
                    <p className="bp-overline mb-1 text-primary-foreground">Yearly Investment</p>
                    <p className="text-5xl bp-stat-value text-primary-foreground">{formatCurrency(plan.totalCost)}</p>
                </div>
                <div className="text-right">
                    <p className="bp-overline mb-1 text-primary-foreground">Membership Tier</p>
                    <p className="text-xl bp-stat-value text-primary-foreground">{qualifyingTier?.name || 'Standard'}</p>
                </div>
            </div>
            <div className="bg-card p-5 px-8 bp-container-compact border shadow-sm">
                <p className="bp-overline mb-1">Avg. Visit</p>
                <p className="text-3xl bp-stat-value">{formatCurrency(plan.averageAppointmentCost)}</p>
            </div>
            <div className="bg-card p-5 px-8 bp-container-compact border shadow-sm">
                <p className="bp-overline mb-1">Avg. Monthly</p>
                <p className="text-3xl bp-stat-value">{formatCurrency(plan.averageMonthlySpend)}</p>
            </div>
            <div className="col-span-2 bg-accent p-5 bp-container-compact shadow-sm flex justify-between items-center">
                <span className="bp-overline text-accent-foreground">Planned Visits</span>
                <span className="text-3xl bp-stat-value text-accent-foreground">{plan.totalYearlyAppointments}</span>
            </div>
        </div>

        <div className="bg-card p-6 bp-container-tall mb-8 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <h3 className="bp-overline">Service Blueprint</h3>
                <span className="bp-caption text-muted-foreground">Cost Per Appointment</span>
            </div>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                        data={visitChartData} 
                        margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                        onClick={(data: any) => {
                            if (data?.activePayload?.[0]?.payload?._appointment) {
                                setSelectedChartVisit(data.activePayload[0].payload._appointment);
                            }
                        }}
                        style={{cursor: 'pointer'}}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis 
                            dataKey="name" 
                            tick={({x, y, payload, index}: any) => {
                                const item = visitChartData[index];
                                return (
                                    <text x={x} y={y + 10} textAnchor="end" fontSize={10} fontWeight={600} fill={item?.isPast ? 'var(--muted-foreground)' : 'var(--foreground)'} transform={`rotate(-45, ${x}, ${y + 10})`}>
                                        {item?.isPast ? `✓ ${payload.value}` : payload.value}
                                    </text>
                                );
                            }}
                            axisLine={{stroke:'var(--border)', strokeWidth:2}} 
                            tickLine={false}
                            interval={0}
                        />
                        <YAxis 
                            tick={{fontSize: 10, fontWeight: 600, fill: 'var(--muted-foreground)'}} 
                            axisLine={{stroke:'var(--border)', strokeWidth:2}} 
                            tickLine={false} 
                        />
                        <Tooltip 
                            cursor={{fill: 'var(--muted)'}}
                            content={({active, payload}: any) => {
                                if (!active || !payload?.[0]?.payload?._appointment) return null;
                                const appt = payload[0].payload._appointment as PlanAppointment;
                                const totalCost = appt.services.reduce((s, sv) => s + sv.cost, 0);
                                const totalDuration = appt.services.reduce((s, sv) => s + sv.duration, 0);
                                return (
                                    <div className="bg-primary text-primary-foreground p-4 bp-container-list shadow-xl min-w-[200px]">
                                        <p className="bp-caption text-primary-foreground/70 mb-2">
                                            {appt.date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </p>
                                        {appt.services.map((sv, i) => (
                                            <div key={i} className="flex items-center justify-between gap-4 mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: SERVICE_COLORS[sv.name] || '#cbd5e1'}} />
                                                    <span className="text-xs font-semibold">{sv.name}</span>
                                                </div>
                                                <div className="text-right text-xs">
                                                    <span className="font-bold">{formatCurrency(sv.cost)}</span>
                                                    <span className="text-primary-foreground/60 ml-1">· {sv.duration}m</span>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="border-t border-primary-foreground/20 mt-2 pt-2 flex justify-between text-xs font-bold">
                                            <span>{totalDuration} min total</span>
                                            <span>{formatCurrency(totalCost)}</span>
                                        </div>
                                    </div>
                                );
                            }}
                        />
                        {serviceLegend.map((name: string) => (
                            <Bar 
                                key={name} 
                                dataKey={name} 
                                stackId="a" 
                                fill={SERVICE_COLORS[name] || '#cbd5e1'} 
                                radius={[0,0,0,0]} 
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
                {serviceLegend.map((name: string) => (
                    <div key={name} className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: SERVICE_COLORS[name] || '#cbd5e1'}}></div>
                        <span className="bp-caption text-muted-foreground">{name}</span>
                    </div>
                ))}
            </div>
        </div>

        {selectedChartVisit && (
            <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setSelectedChartVisit(null)}>
                <div className="bg-card w-full max-w-md bp-container-tall shadow-2xl border border-border overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="bg-primary p-6">
                        <p className="bp-overline text-primary-foreground mb-1">Visit Details</p>
                        <p className="bp-section-title text-primary-foreground">
                            {selectedChartVisit.date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>
                    <div className="p-6 space-y-4">
                        {selectedChartVisit.services.map((service, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-muted bp-container-list">
                                <div className="flex items-center space-x-3">
                                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: SERVICE_COLORS[service.name] || '#cbd5e1'}}></div>
                                    <div>
                                        <p className="bp-card-title">{service.name}</p>
                                        <p className="bp-caption text-muted-foreground">{service.duration} min</p>
                                    </div>
                                </div>
                                <p className="bp-stat-value text-lg">{formatCurrency(service.cost)}</p>
                            </div>
                        ))}
                        <div className="flex justify-between items-center pt-4 border-t border-border">
                            <div>
                                <p className="bp-overline">Total</p>
                                <p className="bp-caption text-muted-foreground">
                                    {selectedChartVisit.services.reduce((sum, s) => sum + s.duration, 0)} min
                                </p>
                            </div>
                            <p className="text-2xl bp-stat-value">
                                {formatCurrency(selectedChartVisit.services.reduce((sum, s) => sum + s.cost, 0))}
                            </p>
                        </div>
                        <div className="flex space-x-3 pt-2">
                            {canBook && new Date(selectedChartVisit.date) >= new Date() && (
                                <button
                                    onClick={() => {
                                        const visit = selectedChartVisit;
                                        setSelectedChartVisit(null);
                                        setSelectedVisit(visit);
                                        setBookingDate(visit.date);
                                        setCalendarMonth(visit.date);
                                        setBookingModalOpen(true);
                                        setBookingStep('select-visit');
                                        setBookingSuccess(false);
                                        setFetchError(null);
                                        handleVisitSelected(visit);
                                    }}
                                    className="flex-1 py-3 bp-container-compact font-bold shadow-lg flex items-center justify-center space-x-2 active:scale-95 transition-all bg-primary text-primary-foreground"
                                >
                                    <CalendarIcon className="w-5 h-5" />
                                    <span>Book This Visit</span>
                                </button>
                            )}
                            <button
                                onClick={() => setSelectedChartVisit(null)}
                                className="flex-1 py-3 bp-container-compact font-bold flex items-center justify-center active:scale-95 transition-all bg-muted text-foreground"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        <div className="flex flex-col gap-4 mb-4">
            {!isClient && !isPlanActive && (
                <button onClick={handlePublish} disabled={isPublishing} className="w-full py-4 bp-container-compact font-bold text-lg shadow-sm flex items-center justify-center space-x-3 active:scale-95 transition-all bg-accent text-accent-foreground">
                    {isPublishing ? <RefreshIcon className="w-6 h-6 animate-spin" /> : <GlobeIcon className="w-6 h-6" />}
                    <span>PUBLISH TO CLIENT</span>
                </button>
            )}
            
            {!isClient && membershipConfig.enabled && (
                <button
                    onClick={() => setMembershipModalOpen(true)}
                    className={`w-full py-4 bp-container-compact font-bold text-lg flex items-center justify-center space-x-3 shadow-sm active:scale-95 transition-all text-black`}
                    style={{ backgroundColor: 'rgba(183, 219, 234, 1)' }}
                >
                    {isMemberOffered || isMemberActive ? <CheckCircleIcon className="w-6 h-6" /> : <PlusIcon className="w-6 h-6" />}
                    <span>{isMemberOffered ? 'INVITATION SENT' : isMemberActive ? 'MEMBERSHIP ACTIVE' : 'SEND MEMBERSHIP INVITATION'}</span>
                </button>
            )}

            <button 
                onClick={handleOpenBooking} 
                disabled={!canBook}
                className={`w-full py-4 bp-container-compact font-bold text-lg shadow-sm active:scale-95 transition-all flex items-center justify-center space-x-3 ${canBook ? 'bg-accent text-accent-foreground' : 'cursor-not-allowed bg-muted text-muted-foreground'}`}
            >
                <CalendarIcon className="w-6 h-6" />
                <span>{isClient ? 'BOOK APPOINTMENT' : canBook ? 'Book an Upcoming Appointment' : 'SYNC DISABLED'}</span>
            </button>
        </div>
      </div>

      {isMembershipModalOpen && (
          <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
              <div className="bg-card w-full max-w-sm bp-container-tall shadow-2xl relative overflow-hidden border-4 flex flex-col border-primary">
                  <div className="p-7 text-center bg-primary">
                      <h2 className="text-2xl font-bold tracking-tight text-primary-foreground">Membership Invitation</h2>
                      <p className="bp-caption uppercase tracking-widest mt-1 text-primary-foreground/80">{"Upgrade "}{plan.client.name.split(' ')[0]}{"'s Experience"}</p>
                  </div>
                  
                  <div className="p-6">
                      {inviteSent ? (
                        <div className="py-12 text-center animate-bounce-in">
                            <CheckCircleIcon className="w-20 h-20 text-accent mx-auto mb-4" />
                            <p className="text-2xl font-bold text-foreground">INVITE SENT!</p>
                            <p className="bp-body-sm mt-2 text-muted-foreground">{"Client marked as 'Offered'"}</p>
                            <button
                                onClick={() => { setMembershipModalOpen(false); setInviteSent(false); }}
                                className="mt-6 px-8 py-3 font-bold bp-container-compact bg-primary text-primary-foreground active:scale-95 transition-all"
                            >
                                DONE
                            </button>
                        </div>
                      ) : (
                        <div className="space-y-6 text-foreground">
                            <div>
                                <label className="block bp-caption uppercase tracking-widest mb-3 text-muted-foreground">Delivery Method</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button onClick={() => setDeliveryMethod('sms')} className={`p-3 bp-container-list border-4 font-bold text-xs transition-all ${deliveryMethod === 'sms' ? 'bg-primary/10 border-primary text-primary' : 'border-muted bg-muted text-muted-foreground'}`}>SMS</button>
                                    <button onClick={() => setDeliveryMethod('email')} className={`p-3 bp-container-list border-4 font-bold text-xs transition-all ${deliveryMethod === 'email' ? 'bg-primary/10 border-primary text-primary' : 'border-muted bg-muted text-muted-foreground'}`}>EMAIL</button>
                                    <button onClick={() => setDeliveryMethod('link')} className={`p-3 bp-container-list border-4 font-bold text-xs transition-all ${deliveryMethod === 'link' ? 'bg-primary/10 border-primary text-primary' : 'border-muted bg-muted text-muted-foreground'}`}>LINK</button>
                                </div>
                            </div>

                            {isContactRestricted && (
                                <div className="bg-amber-50 p-4 bp-container-list border-2 border-amber-100 flex items-start space-x-3">
                                    <div className="bg-amber-500 text-white rounded-full p-1 mt-0.5">!</div>
                                    <div>
                                        <p className="bp-caption text-amber-600 uppercase tracking-widest">Permission Required</p>
                                        <p className="bp-body-sm text-amber-900 leading-tight">You do not have access to client contact details. Ask an admin to enable contact visibility for your level.</p>
                                    </div>
                                </div>
                            )}
                            {isMissingContact && (
                                <div className="bg-red-50 p-4 bp-container-list border-2 border-red-100 flex items-start space-x-3">
                                    <div className="bg-red-500 text-white rounded-full p-1 mt-0.5">!</div>
                                    <div>
                                        <p className="bp-caption text-red-600 uppercase tracking-widest">Contact Missing</p>
                                        <p className="bp-body-sm text-red-800 leading-tight">No {deliveryMethod === 'sms' ? 'phone' : 'email'} found for this client. You can still open the app, but you{"'"}ll need to manually enter the recipient.</p>
                                    </div>
                                </div>
                            )}

                            <div className="p-4 bp-container-list border-2 bg-muted border">
                                <p className="bp-caption uppercase mb-2 tracking-widest text-muted-foreground">Projected membership pricing</p>
                                <div className="flex flex-col gap-3 text-foreground">
                                    <div>
                                        <p className="bp-caption uppercase tracking-widest text-muted-foreground">Projected yearly total</p>
                                        <p className="text-lg font-bold">{formatCurrency(plan.totalCost)}</p>
                                    </div>
                                    <div>
                                        <p className="bp-caption uppercase tracking-widest text-muted-foreground">Estimated monthly membership</p>
                                        <p className="text-lg font-bold">{formatCurrency(projectedMonthlySpend)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bp-container-list border-2 bg-muted border">
                                <p className="bp-caption uppercase mb-2 tracking-widest text-muted-foreground">Message Preview</p>
                                <div className="bg-card p-4 bp-container-list border-2 text-xs font-bold leading-relaxed shadow-inner border text-muted-foreground whitespace-pre-wrap">
                                    {invitationMessage}
                                </div>
                            </div>

                            <button
                                onClick={handleSendInvite}
                                disabled={isSendingInvite || isContactRestricted}
                                className="w-full font-bold py-5 bp-container-compact shadow-xl flex items-center justify-center space-x-3 active:scale-95 transition-all border-b-8 border-black/20 disabled:opacity-50 bg-primary text-primary-foreground"
                            >
                                {isSendingInvite ? <RefreshIcon className="w-6 h-6 animate-spin" /> : <ShareIcon className="w-6 h-6" />}
                                <span>{isSendingInvite ? 'OPENING...' : isContactRestricted ? 'CONTACT ACCESS REQUIRED' : `OPEN ${deliveryMethod.toUpperCase()}`}</span>
                            </button>
                            
                            <button onClick={() => setMembershipModalOpen(false)} className="w-full text-center bp-caption uppercase tracking-widest hover:opacity-70 transition-colors text-muted-foreground">Cancel</button>
                        </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {isViewingMembershipDetails && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
            <div className="bg-card w-full max-w-sm bp-container-tall shadow-2xl relative overflow-hidden border-4 flex flex-col max-h-[90vh] border-primary">
                <div className="p-7 text-center bg-primary">
                    <h2 className="text-2xl font-bold tracking-tight text-primary-foreground">Membership Details</h2>
                    <p className="bp-caption uppercase tracking-widest mt-1 text-primary-foreground/80">Based on Your Blueprint</p>
                </div>
                <div className="p-6 overflow-y-auto flex-grow">
                    <div className="mb-6 p-5 bp-container-list border-2 text-center bg-muted border">
                        <p className="bp-caption uppercase tracking-widest mb-1 text-muted-foreground">Your Membership Level</p>
                        <p className="text-2xl font-bold" style={{ color: qualifyingTier?.color || 'var(--accent)' }}>{qualifyingTier?.name || 'Standard'}</p>
                    </div>

                    <div className="mb-6 p-5 bp-container-list border-2 text-center bg-muted border">
                        <p className="bp-caption uppercase tracking-widest mb-2 text-muted-foreground">Projected membership pricing</p>
                        <div className="space-y-3">
                          <div>
                            <p className="bp-caption uppercase tracking-widest text-muted-foreground">Projected yearly total</p>
                            <p className="text-xl bp-stat-value">{formatCurrency(plan.totalCost)}</p>
                          </div>
                          <div>
                            <p className="bp-caption uppercase tracking-widest text-muted-foreground">Estimated monthly membership</p>
                            <p className="text-xl bp-stat-value">{formatCurrency(projectedMonthlySpend)}</p>
                          </div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h3 className="bp-overline mb-4">Membership Perks</h3>
                        {qualifyingTier?.perks && qualifyingTier.perks.length > 0 ? (
                            <ul className="space-y-3">
                                {qualifyingTier.perks.map((perk, index) => (
                                    <li key={index} className="flex items-start bp-body-sm text-muted-foreground">
                                        <CheckCircleIcon className="w-5 h-5 text-accent mr-3 flex-shrink-0 mt-0.5" />
                                        <span>{perk}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="p-4 bp-container-list border-2 text-center text-xs font-bold bg-muted border text-muted-foreground">
                                <p>This membership includes benefits defined by your salon. Your stylist can walk you through the details.</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="p-4 bp-container-list border-2 text-center text-xs font-bold mb-6 bg-muted border text-muted-foreground">
                        <p>Your membership is custom-tailored to you and is based on the services you and your stylist agreed on when creating your maintenance blueprint.</p>
                        <p className="mt-2 bp-caption italic text-muted-foreground">*Additional services not included in your blueprint may be an additional cost, unless explicitly listed as a membership perk.</p>
                    </div>

                    <button 
                        onClick={handleAcceptMembership}
                        disabled={isAccepting}
                        className="w-full font-bold py-5 bp-container-compact shadow-xl flex items-center justify-center space-x-3 active:scale-95 transition-all border-b-8 border-black/20 bg-primary text-primary-foreground"
                    >
                        {isAccepting ? <RefreshIcon className="w-6 h-6 animate-spin"/> : "Enroll in Membership"}
                    </button>
                </div>
                
                <button onClick={() => setIsViewingMembershipDetails(false)} className="w-full p-6 font-bold uppercase tracking-widest bp-caption border-t-4 transition-colors hover:opacity-70 text-muted-foreground border">
                    Maybe Later
                </button>
            </div>
        </div>
      )}

      {isBookingModalOpen && (
          <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
              <div className="bg-card w-full max-w-sm bp-container-tall shadow-2xl relative overflow-hidden border-4 flex flex-col max-h-[90vh] border-primary">
                  
                  <div className="text-primary-foreground p-6 relative bg-primary">
                    {bookingStep !== 'select-visit' && !bookingSuccess && (
                        <button onClick={() => {
                           if (bookingStep === 'confirm') setBookingStep('select-slot');
                           else if (bookingStep === 'select-slot') setBookingStep('select-period');
                           else if (bookingStep === 'select-period') setBookingStep('select-date');
                           else if (bookingStep === 'select-date') setBookingStep('select-visit');
                        }} className="absolute left-4 top-6">
                            <ChevronLeftIcon className="w-6 h-6" />
                        </button>
                    )}
                    <h2 className="text-xl font-bold text-center">Square Booking</h2>
                    <p className="bp-caption text-center uppercase tracking-widest mt-1 text-primary-foreground/80">
                        {bookingStep === 'select-visit' ? 'Which visit are you booking?' : 
                         bookingStep === 'select-date' ? 'Confirm your appointment date' :
                         bookingStep === 'select-period' ? 'What time of day do you prefer?' :
                         bookingStep === 'confirm' ? 'Review & confirm your booking' : 'Choose your perfect opening'}
                    </p>
                  </div>

                  <div className="p-6 overflow-y-auto flex-grow">
                      {bookingSuccess ? (
                          <div className="py-12 text-center animate-bounce-in">
                              <CheckCircleIcon className="w-20 h-20 text-accent mx-auto mb-4" />
                              <p className="text-3xl font-bold text-foreground">BOOKED!</p>
                              <p className="text-lg font-bold mt-2 text-foreground">Added to Square calendar.</p>
                              <button
                                  onClick={() => { setBookingModalOpen(false); setBookingSuccess(false); }}
                                  className="mt-6 px-8 py-3 font-bold bp-container-compact bg-primary text-primary-foreground active:scale-95 transition-all"
                              >
                                  DONE
                              </button>
                          </div>
                      ) : fetchError ? (
                          <div className="p-6 bg-red-50 text-red-950 bp-container-list border-4 border-red-500 text-center">
                              <p className="font-bold uppercase text-xs mb-3 text-red-700">Square Error</p>
                              <p className="text-base font-bold leading-relaxed mb-6">{fetchError}</p>
                              <button onClick={() => setBookingModalOpen(false)} className="w-full py-4 bg-red-700 text-white bp-container-compact font-bold uppercase shadow-xl border-b-4 border-red-900">Close</button>
                          </div>
                      ) : (
                          <>
                              {bookingStep === 'select-visit' && (
                                  <div className="space-y-3 text-foreground">
                                      <p className="text-center text-xs pb-2 text-muted-foreground">{"Select a planned visit below. You'll confirm the exact date in the next step."}</p>
                                      {futureVisits.length > 0 ? futureVisits.map((visit, i) => {
                                          const totalCost = visit.services.reduce((sum, s) => sum + s.cost, 0);
                                          const totalDuration = visit.services.reduce((sum, s) => sum + s.duration, 0);
                                          const formatDuration = (minutes: number) => {
                                              const h = Math.floor(minutes / 60);
                                              const m = minutes % 60;
                                              return `${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m` : ''}`.trim() || '0m';
                                          };
                                          return (
                                              <button key={i} onClick={() => handleVisitSelected(visit)} className="w-full p-5 border-4 bp-container-list text-left flex flex-col group active:scale-95 transition-all hover:border-accent elevated-card border">
                                                  <div className="flex justify-between items-center w-full">
                                                      <div>
                                                          <p className="bp-caption uppercase tracking-widest mb-1 text-muted-foreground">Upcoming Visit</p>
                                                          <p className="text-xl font-bold group-hover:text-accent">{visit.date.toLocaleDateString([], {month:'long', day:'numeric'})}</p>
                                                      </div>
                                                      <ChevronRightIcon className="w-6 h-6 text-muted-foreground" />
                                                  </div>
                                                  
                                                  <div className="border-t mt-4 pt-4 space-y-2 border-border">
                                                      <p className="bp-caption uppercase tracking-widest mb-1 text-muted-foreground">Visit Details:</p>
                                                      <div className="flex justify-between items-center text-sm">
                                                          <span className="font-bold text-muted-foreground">Services:</span>
                                                          <span className="font-bold truncate max-w-[150px] text-foreground">{visit.services.map(s => s.name).join(' + ')}</span>
                                                      </div>
                                                      <div className="flex justify-between items-center text-sm">
                                                          <span className="font-bold text-muted-foreground">Est. Cost:</span>
                                                          <span className="font-bold text-foreground">${totalCost.toFixed(0)}</span>
                                                      </div>
                                                      <div className="flex justify-between items-center text-sm">
                                                          <span className="font-bold text-muted-foreground">Est. Time:</span>
                                                          <span className="font-bold text-foreground">{formatDuration(totalDuration)}</span>
                                                      </div>
                                                  </div>
                                              </button>
                                          )
                                      }) : (
                                          <div className="text-center py-10">
                                              <p className="font-bold text-lg leading-tight text-foreground">{"No future blueprint visits"}<br/>{"available to sync."}</p>
                                          </div>
                                      )}
                                  </div>
                              )}

                              {bookingStep === 'select-date' && (
                                isFetchingSlots ? (
                                    <div className="py-16 text-center">
                                        <RefreshIcon className="w-16 h-16 text-accent animate-spin mx-auto mb-6" />
                                        <p className="font-bold uppercase tracking-widest text-foreground">Finding Openings...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="text-center p-3 bp-container-list border-2 mb-4 bg-muted border">
                                            <p className="bp-caption uppercase tracking-widest text-muted-foreground">Recommended Date</p>
                                            <p className="font-bold text-base text-foreground">{selectedVisit?.date.toLocaleDateString([], {weekday: 'long', month: 'long', day: 'numeric'})}</p>
                                        </div>

                                        <div className="bg-card p-3 bp-container-list border-2 border">
                                            <div className="flex justify-between items-center mb-3 px-2">
                                                <button onClick={() => setCalendarMonth(new Date(year, month - 1, 1))} className="p-2 rounded-full hover:opacity-70 text-muted-foreground">{'<'}</button>
                                                <h3 className="font-bold text-foreground">{calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                                                <button onClick={() => setCalendarMonth(new Date(year, month + 1, 1))} className="p-2 rounded-full hover:opacity-70 text-muted-foreground">{'>'}</button>
                                            </div>
                                            <div className="grid grid-cols-7 text-center text-xs font-bold mb-2 text-muted-foreground">
                                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
                                            </div>
                                            <div className="grid grid-cols-7 gap-1">
                                                {calendarBlanks.map((_, i) => <div key={`blank-${i}`}></div>)}
                                                {calendarDays.map(day => {
                                                    const thisDate = new Date(year, month, day);
                                                    const dateStr = thisDate.toISOString().split('T')[0];
                                                    const isAvailable = availableDates.has(dateStr);
                                                    const isSelected = bookingDate ? bookingDate.toISOString().split('T')[0] === dateStr : false;
                                                    
                                                    return (
                                                        <button 
                                                            key={day} 
                                                            disabled={!isAvailable}
                                                            onClick={() => {
                                                                const newDate = new Date(dateStr);
                                                                const timezoneOffset = newDate.getTimezoneOffset() * 60000;
                                                                setBookingDate(new Date(newDate.getTime() + timezoneOffset));
                                                            }}
                                                            className={`p-2 rounded-full font-bold text-sm aspect-square transition-all ${
                                                                isSelected ? 'bg-primary text-primary-foreground scale-110 shadow-lg' : 
                                                                isAvailable ? 'bg-card text-foreground hover:opacity-70' : 'cursor-not-allowed opacity-50 bg-muted text-muted-foreground'
                                                            }`}
                                                        >
                                                            {day}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <button 
                                            onClick={async () => {
                                                if (!bookingDate || !selectedVisit) return;
                                                setIsFetchingSlots(true);
                                                setFetchError(null);
                                                try {
                                                    const loc = await SquareIntegrationService.fetchLocation();
                                                    let stylistId = isClient ? plan.stylistId : (user?.stylistData?.id || allStylists[0]?.id);
                                                    if (stylistId && !String(stylistId).startsWith('TM')) {
                                                        const validStylist = allStylists.find(s => String(s.id).startsWith('TM'));
                                                        if (validStylist) stylistId = validStylist.id;
                                                    }
                                                    if (!stylistId) throw new Error("No team member selected or found.");
                                                    const serviceToBook = selectedVisit.services[0];
                                                    if (!serviceToBook) throw new Error("No service selected for this visit.");
                                                    const squareCatalog = await SquareIntegrationService.fetchCatalog();
                                                    let serviceVariationId = serviceToBook.id;
                                                    const existingService = squareCatalog.find(s => s.id === serviceVariationId);
                                                    if (!existingService) {
                                                        let squareService = squareCatalog.find(s => s.name === serviceToBook.name) || squareCatalog.find(s => s.name.toLowerCase() === serviceToBook.name.toLowerCase());
                                                        if (!squareService?.id) throw new Error(`Service "${serviceToBook.name}" not found in Square catalog.`);
                                                        serviceVariationId = squareService.id;
                                                    }
                                                    const searchStart = new Date(bookingDate);
                                                    searchStart.setDate(searchStart.getDate() - 3);
                                                    const now = new Date();
                                                    if (searchStart < now) searchStart.setTime(now.getTime());
                                                    const slots = await SquareIntegrationService.findAvailableSlots({
                                                        locationId: loc.id,
                                                        startAt: SquareIntegrationService.formatDate(searchStart, loc.timezone),
                                                        teamMemberId: stylistId,
                                                        serviceVariationId
                                                    });
                                                    setAvailableSlots(slots);
                                                    setBookingStep('select-period');
                                                } catch (e: any) {
                                                    setFetchError(e.message);
                                                } finally {
                                                    setIsFetchingSlots(false);
                                                }
                                            }}
                                            disabled={!bookingDate || isFetchingSlots}
                                            className={`w-full font-bold py-5 bp-container-compact shadow-xl transition-all active:scale-95 border-b-8 border-black/20 disabled:opacity-40 ${bookingDate ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                                        >
                                            {isFetchingSlots ? 'Finding openings...' : 'Confirm Date'}
                                        </button>
                                    </div>
                                )
                              )}
                              
                              {bookingStep === 'select-period' && (
                                  <div className="space-y-4">
                                      {availablePeriods.morning && (
                                      <button onClick={() => confirmPeriodAndFetch('morning')} className="w-full p-6 bg-primary/5 border-4 border bp-container-list text-left flex items-center space-x-4 active:scale-95 transition-all">
                                          <div className="bg-primary text-primary-foreground p-3 bp-container-list text-xl">{'🌅'}</div>
                                          <div>
                                              <p className="text-xl font-bold leading-none text-foreground">Morning</p>
                                              <p className="bp-caption uppercase tracking-widest text-muted-foreground mt-2">Before 12:00 PM</p>
                                          </div>
                                      </button>
                                      )}
                                      {availablePeriods.afternoon && (
                                      <button onClick={() => confirmPeriodAndFetch('afternoon')} className="w-full p-6 bg-accent/5 border-4 border bp-container-list text-left flex items-center space-x-4 active:scale-95 transition-all">
                                          <div className="bg-accent text-accent-foreground p-3 bp-container-list text-xl">{'☀️'}</div>
                                          <div>
                                              <p className="text-xl font-bold leading-none text-foreground">Afternoon</p>
                                              <p className="bp-caption uppercase tracking-widest text-muted-foreground mt-2">12:00 PM - 5:00 PM</p>
                                          </div>
                                      </button>
                                      )}
                                      {availablePeriods.evening && (
                                      <button onClick={() => confirmPeriodAndFetch('evening')} className="w-full p-6 bg-secondary/5 border-4 border bp-container-list text-left flex items-center space-x-4 active:scale-95 transition-all">
                                          <div className="bg-secondary text-secondary-foreground p-3 bp-container-list text-xl">{'🌙'}</div>
                                          <div>
                                              <p className="text-xl font-bold leading-none text-foreground">Evening</p>
                                              <p className="bp-caption uppercase tracking-widest text-muted-foreground mt-2">After 5:00 PM</p>
                                          </div>
                                      </button>
                                      )}
                                      {!availablePeriods.morning && !availablePeriods.afternoon && !availablePeriods.evening && (
                                          <div className="text-center py-10 text-foreground">
                                              <p className="font-bold text-lg leading-tight">No openings found<br/>for this date range.</p>
                                              <button onClick={() => setBookingStep('select-date')} className="mt-4 text-accent font-bold underline">Try a different date</button>
                                          </div>
                                      )}
                                  </div>
                              )}

                              {bookingStep === 'select-slot' && (
                                  <div className="space-y-6">
                                      {Object.keys(groupedSlots).length > 0 ? Object.entries(groupedSlots).map(([day, slots]) => (
                                          <div key={day}>
                                              <h3 className="bp-caption uppercase mb-3 tracking-widest border-b-2 pb-2 text-muted-foreground border">{day}</h3>
                                              <div className="grid grid-cols-2 gap-2">
                                                  {(slots as string[]).map((s, i) => (
                                                      <button key={i} onClick={() => { setSelectedSlotTime(s); setBookingStep('confirm'); }} disabled={isBooking} className="p-4 border-4 bp-container-list text-center hover:border-accent active:scale-95 transition-all elevated-card border text-foreground">
                                                          <span className="font-bold text-base">{new Date(s).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                      </button>
                                                  ))}
                                              </div>
                                          </div>
                                      )) : (
                                          <div className="text-center py-10 text-foreground">
                                              <p className="font-bold text-lg leading-tight">No {timePeriod !== 'all' ? timePeriod : ''} openings<br/>found this week.</p>
                                              <button onClick={() => setBookingStep('select-period')} className="mt-4 text-accent font-bold underline">Change preference</button>
                                          </div>
                                      )}

                                      {isFetchingSlots && (
                                          <div className="text-center py-8">
                                              <RefreshIcon className="w-12 h-12 text-accent animate-spin mx-auto" />
                                          </div>
                                      )}
                                  </div>
                              )}

                              {bookingStep === 'confirm' && selectedSlotTime && selectedVisit && (
                                  <div className="space-y-5">
                                      <div className="p-5 bp-container-list border-2 bg-muted border">
                                          <p className="bp-overline mb-3">Appointment Date & Time</p>
                                          <p className="text-lg font-bold text-foreground">
                                              {new Date(selectedSlotTime).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                          </p>
                                          <p className="text-2xl bp-stat-value text-accent mt-1">
                                              {new Date(selectedSlotTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </p>
                                      </div>

                                      <div className="p-5 bp-container-list border-2 bg-muted border">
                                          <p className="bp-overline mb-3">Services</p>
                                          <div className="space-y-2">
                                              {selectedVisit.services.map((s, i) => (
                                                  <div key={i} className="flex justify-between items-center">
                                                      <div>
                                                          <p className="font-bold text-sm text-foreground">{s.name}</p>
                                                          <p className="bp-caption text-muted-foreground">{s.duration} min</p>
                                                      </div>
                                                      <p className="font-bold text-foreground">{formatCurrency(s.cost)}</p>
                                                  </div>
                                              ))}
                                          </div>
                                          <div className="border-t mt-3 pt-3 flex justify-between items-center border-border">
                                              <div>
                                                  <p className="font-bold text-sm text-foreground">Total</p>
                                                  <p className="bp-caption text-muted-foreground">
                                                      {selectedVisit.services.reduce((sum, s) => sum + s.duration, 0)} min
                                                  </p>
                                              </div>
                                              <p className="text-lg bp-stat-value text-foreground">
                                                  {formatCurrency(selectedVisit.services.reduce((sum, s) => sum + s.cost, 0))}
                                              </p>
                                          </div>
                                      </div>

                                      <div className="p-5 bp-container-list border-2 bg-muted border">
                                          <p className="bp-overline mb-2">Client</p>
                                          <p className="font-bold text-foreground">{plan.client.name}</p>
                                      </div>

                                      {cancellationPolicy && (
                                          <div className="p-4 bp-container-list border-2 border-amber-500/30 bg-amber-500/5">
                                              <p className="bp-overline mb-2 text-amber-600">Cancellation Policy</p>
                                              <p className="bp-body-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{cancellationPolicy}</p>
                                          </div>
                                      )}

                                      <button
                                          onClick={() => executeBooking(selectedSlotTime)}
                                          disabled={isBooking}
                                          className="w-full font-bold py-5 bp-container-compact shadow-xl flex items-center justify-center space-x-3 active:scale-95 transition-all border-b-8 border-black/20 disabled:opacity-50 bg-accent text-accent-foreground"
                                      >
                                          {isBooking ? (
                                              <RefreshIcon className="w-6 h-6 animate-spin" />
                                          ) : (
                                              <CalendarIcon className="w-6 h-6" />
                                          )}
                                          <span>{isBooking ? 'BOOKING...' : 'CONFIRM BOOKING'}</span>
                                      </button>
                                  </div>
                              )}
                          </>
                      )}
                  </div>

                  {!bookingSuccess && bookingStep !== 'confirm' && (
                      <button onClick={() => setBookingModalOpen(false)} className="w-full p-6 font-bold uppercase tracking-widest bp-caption border-t-4 hover:opacity-70 transition-colors text-muted-foreground border">Cancel Booking</button>
                  )}
                  {bookingStep === 'confirm' && !bookingSuccess && (
                      <button onClick={() => setBookingModalOpen(false)} className="w-full p-6 font-bold uppercase tracking-widest bp-caption border-t-4 hover:opacity-70 transition-colors text-muted-foreground border">Cancel</button>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default PlanSummaryStep;
