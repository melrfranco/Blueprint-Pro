import React, { useState } from 'react';
import type { GeneratedPlan } from '../types';

interface PlanEditorProps {
  plan: GeneratedPlan;
}

const PlanEditor: React.FC<PlanEditorProps> = ({ plan }) => {
  const [loading, setLoading] = useState(false);

  return (
    <div className="p-4 text-sm text-muted-foreground">
      Visual editor temporarily disabled.
    </div>
  );
};

export default PlanEditor;
