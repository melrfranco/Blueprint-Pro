
import React, { useState, useEffect } from 'react';
import type { Service, PlanDetails, Client } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';

interface SetDatesStepProps {
  selectedServices: Service[];
  planDetails: PlanDetails;
  client: Client;
  onNext: (details: PlanDetails) => void;
  onBack: () => void;
}

type SelectionMode = 'today' | 'next' | 'last' | 'offset' | 'custom';

const SetDatesStep: React.FC<SetDatesStepProps> = ({ selectedServices, planDetails, client, onNext, onBack }) => {
  const [localDetails, setLocalDetails] = useState<PlanDetails>(planDetails);
  const [selections, setSelections] = useState<{[key: string]: SelectionMode | null}>({});
  const [offsets, setOffsets] = useState<{[key: string]: number}>({});
  const { branding } = useSettings();

  useEffect(() => {
    setLocalDetails(planDetails);
  }, [planDetails]);

  const handleDateChange = (serviceId: string, date: Date | null, mode: SelectionMode | null) => {
    let finalDate: Date | null = null;
    if (date) {
        const newDate = new Date(date);
        const timezoneOffset = newDate.getTimezoneOffset() * 60000;
        finalDate = new Date(newDate.getTime() + timezoneOffset);
    }
    
    setLocalDetails(prev => ({ ...prev, [serviceId]: { ...prev[serviceId], firstDate: finalDate }}));
    setSelections(prev => ({...prev, [serviceId]: mode}));
  };
  
  const handleOffsetChange = (serviceId: string, weeks: number) => {
      const offsetVal = Math.max(0, weeks);
      setOffsets(prev => ({...prev, [serviceId]: offsetVal}));
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + offsetVal * 7);
      handleDateChange(serviceId, newDate, 'offset');
  }

  const isNextDisabled = selectedServices.some(service => !localDetails[service.id]?.firstDate);

  const getButtonClass = (isSelected: boolean, isDisabled: boolean) => {
      let base = "p-3 rounded-lg transition-all ";
      if (isDisabled) return base + "cursor-not-allowed";
      if (isSelected) return base + "shadow-md";
      return base + "bg-white shadow-sm";
  };

  const getButtonStyle = (isSelected: boolean, isDisabled: boolean) => {
      if (isDisabled) return { backgroundColor: '#E2EAF0', color: '#8EB1BF', border: '1px solid #C5D5DE' };
      if (isSelected) return { backgroundColor: branding.secondaryColor, color: ensureAccessibleColor('#FFFFFF', branding.secondaryColor, '#F0F4F8'), borderColor: branding.secondaryColor };
      return { color: '#42708C', border: '1px solid #C5D5DE' };
  };

  return (
    <div className="flex flex-col h-full p-4 pb-12">
      <div className="text-center p-4">
        <div className="relative w-full h-2 mb-4 rounded-full" style={{ backgroundColor: '#E2EAF0' }}><div className="absolute top-0 left-0 h-2 bg-brand-secondary rounded-full" style={{width: '33%'}}></div></div>
        <h1 className="text-2xl font-bold" style={{ color: '#0B3559' }}>First Service Date</h1>
      </div>
      
      <div className="flex-grow overflow-y-auto p-4 space-y-6">
        {selectedServices.map(service => (
          <div key={service.id} className="p-4 rounded-xl border shadow-sm" style={{ backgroundColor: '#F0F4F8', borderColor: '#C5D5DE' }}>
            <h3 className="font-bold text-lg mb-3" style={{ color: '#0B3559' }}>{service.name}</h3>
            
            <div className="grid grid-cols-2 gap-3 text-sm font-bold">
                <button 
                    onClick={() => handleDateChange(service.id, new Date(), 'today')} 
                    className={getButtonClass(selections[service.id] === 'today', false)}
                    style={getButtonStyle(selections[service.id] === 'today', false)}
                >
                    Today
                </button>
                <button 
                    onClick={() => handleDateChange(service.id, client.nextAppointmentDate || null, 'next')} 
                    disabled={!client.nextAppointmentDate} 
                    className={getButtonClass(selections[service.id] === 'next', !client.nextAppointmentDate)}
                    style={getButtonStyle(selections[service.id] === 'next', !client.nextAppointmentDate)}
                >
                    Next Scheduled
                </button>
                <button 
                    onClick={() => handleDateChange(service.id, client.lastAppointmentDate || null, 'last')} 
                    disabled={!client.lastAppointmentDate} 
                    className={`col-span-2 ${getButtonClass(selections[service.id] === 'last', !client.lastAppointmentDate)}`}
                    style={getButtonStyle(selections[service.id] === 'last', !client.lastAppointmentDate)}
                >
                    Last Appointment
                </button>
            </div>

             <div className="mt-3 flex items-center space-x-2 text-sm">
                <div 
                  className={`p-2 rounded-lg flex-grow flex items-center justify-center border transition-all ${selections[service.id] === 'offset' ? 'shadow-md' : 'bg-white shadow-sm'}`}
                  style={selections[service.id] === 'offset' ? { backgroundColor: branding.secondaryColor, color: ensureAccessibleColor('#FFFFFF', branding.secondaryColor, '#F0F4F8'), borderColor: branding.secondaryColor } : { borderColor: '#C5D5DE', color: '#42708C' }}
                >
                    <label htmlFor={`offset-${service.id}`} className="font-bold mr-2">In</label>
                    <input 
                        type="number" 
                        id={`offset-${service.id}`} 
                        value={offsets[service.id] || ''} 
                        onChange={e => handleOffsetChange(service.id, parseInt(e.target.value, 10) || 0)} 
                        className="w-16 p-2 border rounded text-center font-bold"
                        style={{ borderColor: '#C5D5DE', color: '#0B3559' }}
                        placeholder="0"
                    />
                    <span className="ml-2 font-bold">weeks</span>
                </div>
            </div>

            <div className="mt-3">
                <label htmlFor={`date-${service.id}`} className="block font-bold mb-1 text-xs uppercase" style={{ color: '#42708C' }}>Or Select Date:</label>
                <input 
                    type="date" 
                    id={`date-${service.id}`} 
                    onChange={e => handleDateChange(service.id, new Date(e.target.value), 'custom')} 
                    className={`w-full p-3 border rounded-lg font-medium shadow-sm`}
                    style={selections[service.id] === 'custom' ? { borderColor: branding.secondaryColor, color: '#0B3559' } : { borderColor: '#C5D5DE', color: '#0B3559' }}
                />
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 mt-auto space-y-3 bg-white border-t" style={{ borderColor: '#E2EAF0' }}>
        <button onClick={() => onNext(localDetails)} disabled={isNextDisabled} className="w-full font-bold py-4 px-4 rounded-full shadow-lg transition-transform transform hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: branding.primaryColor, color: ensureAccessibleColor('#FFFFFF', branding.primaryColor, '#F0F4F8') }}>Next Step</button>
        <button onClick={onBack} className="w-full bg-transparent font-bold py-2 px-4" style={{ color: '#42708C' }}>Back</button>
      </div>
    </div>
  );
};

export default SetDatesStep;
