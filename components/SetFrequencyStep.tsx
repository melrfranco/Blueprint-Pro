import React, { useState, useEffect } from 'react';
import type { Service, PlanDetails } from '../types';
import { useSettings } from '../contexts/SettingsContext';

interface SetFrequencyStepProps {
  selectedServices: Service[];
  planDetails: PlanDetails;
  onNext: (details: PlanDetails) => void;
  onBack: () => void;
}

const SetFrequencyStep: React.FC<SetFrequencyStepProps> = ({ selectedServices, planDetails, onNext, onBack }) => {
  const [localDetails, setLocalDetails] = useState<PlanDetails>(planDetails);
  const { branding } = useSettings();

   useEffect(() => {
    setLocalDetails(planDetails);
  }, [planDetails]);

  const handleFrequencyChange = (serviceId: string, freq: number) => {
    const frequency = Math.max(1, freq);
    setLocalDetails(prev => ({
      ...prev,
      [serviceId]: { ...prev[serviceId], frequency },
    }));
  };
  
  const formatDate = (date: Date | null) => {
      if (!date) return '';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const isNextDisabled = selectedServices.some(service => !localDetails[service.id]?.frequency);

  return (
    <div className="flex flex-col h-full p-4 pb-12">
      <div className="text-center p-4">
        <div className="relative w-full h-2 mb-4 rounded-full bg-muted">
            <div className="absolute top-0 left-0 h-2 bg-primary bp-container-compact" style={{width: '66%'}}></div>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Service Frequency</h1>
        <p className="text-sm text-muted-foreground">How often should these repeat?</p>
      </div>
      
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {selectedServices.map(service => (
          <div key={service.id} className="p-4 bp-container-list border border bg-muted">
            <div className="flex justify-between items-baseline">
                <h3 className="font-bold text-lg mb-3 text-foreground">{service.name}</h3>
                <span className="text-xs text-muted-foreground">Starts: {formatDate(localDetails[service.id]?.firstDate)}</span>
            </div>
            <div className="flex items-center space-x-2">
                <span className="font-medium text-muted-foreground">Every</span>
                 <input 
                    type="number" 
                    value={localDetails[service.id]?.frequency || ''} 
                    onChange={(e) => handleFrequencyChange(service.id, parseInt(e.target.value, 10))}
                    className="w-20 p-2 border border bp-container-list text-center font-bold text-lg bg-card text-foreground"
                    placeholder="Wks"
                />
                <span className="font-medium text-muted-foreground">weeks</span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 mt-auto space-y-2">
        <button
          onClick={() => onNext(localDetails)}
          disabled={isNextDisabled}
          className="w-full font-bold py-3 px-4 bp-container-compact shadow-lg transition-transform transform hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed bg-primary text-primary-foreground"
        >
          Create Maintenance Roadmap
        </button>
        <button
          onClick={onBack}
          className="w-full bg-transparent font-semibold py-2 px-4 text-muted-foreground"
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default SetFrequencyStep;
